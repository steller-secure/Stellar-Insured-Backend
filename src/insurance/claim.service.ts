import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ClaimStatus } from './enums/claim-status.enum';
import { PolicyStatus } from './enums/policy-status.enum';
import { PrismaService } from '../prisma.service';
import { PoolService } from './pool.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';
import { Claim, InsurancePolicy, Prisma } from '@prisma/client';

type ClaimWithPolicy = Claim & { policy: InsurancePolicy };

@Injectable()
export class ClaimService {
  private readonly logger = new Logger(ClaimService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pools: PoolService,
    private readonly eventBus: DomainEventBus,
  ) {}

  async assessClaim(claimId: string): Promise<ClaimWithPolicy> {
    const claim = (await this.prisma.claim.findUnique({
      where: { id: claimId },
      include: { policy: true },
    })) as ClaimWithPolicy | null;

    if (!claim) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    const policy = claim.policy;
    if (!policy) {
      throw new NotFoundException(`Policy for claim ${claimId} not found`);
    }

    const beforeState = { ...claim };

    if (policy.status !== PolicyStatus.ACTIVE) {
      const reason = `Policy is not active: ${policy.status}`;
      await this.updateStatus(claimId, ClaimStatus.REJECTED, reason, 'system');
      throw new BadRequestException('Cannot approve claim for inactive policy');
    }

    if (
      (claim.claimAmount as Prisma.Decimal).gt(
        policy.coverageAmount as Prisma.Decimal,
      )
    ) {
      const reason = 'Claim amount exceeds coverage';
      await this.updateStatus(claimId, ClaimStatus.REJECTED, reason, 'system');
      throw new BadRequestException(
        'Claim amount exceeds policy coverage amount',
      );
    }

    const isFraudulent = await this.runFraudDetection(claim);
    if (isFraudulent) {
      this.logger.warn(`Fraud detection triggered for claim ${claimId}`);
      await this.eventBus.emit(DomainEventName.CLAIM_FRAUD_DETECTED, {
        claimId,
        userId: policy.userId,
        beforeState,
        afterState: claim,
        reason: 'High fraud risk score detected',
      });
    }

    const oracleVerified = await this.verifyOracle(claimId);
    if (!oracleVerified) {
      const reason = 'Oracle verification failed';
      await this.updateStatus(claimId, ClaimStatus.REJECTED, reason, 'system');
      throw new BadRequestException('Oracle verification failed');
    }

    const updatedClaim = await this.prisma.$transaction(async tx => {
      return (await tx.claim.update({
        where: { id: claimId },
        data: { status: ClaimStatus.APPROVED, payoutAmount: claim.claimAmount },
        include: { policy: true },
      })) as ClaimWithPolicy;
    });

    await this.eventBus.emit(DomainEventName.CLAIM_APPROVED, {
      claimId,
      userId: policy.userId,
      beforeState,
      afterState: updatedClaim,
    });

    return updatedClaim;
  }

  private async updateStatus(
    claimId: string,
    status: ClaimStatus,
    reason: string,
    _user: string = 'system',
    additionalData: { payoutAmount?: Prisma.Decimal } = {},
    tx?: Prisma.TransactionClient,
  ): Promise<ClaimWithPolicy> {
    let beforeStateSnapshot: ClaimWithPolicy | null = null;

    const execute = async (client: Prisma.TransactionClient) => {
      const existing = (await client.claim.findUnique({
        where: { id: claimId },
        include: { policy: true },
      })) as ClaimWithPolicy | null;
      if (!existing) throw new NotFoundException('Claim not found');

      beforeStateSnapshot = { ...existing };
      const updated = (await client.claim.update({
        where: { id: claimId },
        data: {
          status,
          ...(additionalData.payoutAmount !== undefined && {
            payoutAmount: additionalData.payoutAmount,
          }),
        },
        include: { policy: true },
      })) as ClaimWithPolicy;

      if (status === ClaimStatus.REJECTED && existing.policy) {
        const claimDecimal = new Prisma.Decimal(existing.claimAmount);
        await this.pools.unlockCapital(
          existing.policy.poolId,
          claimDecimal,
          tx,
        );
      }

      return updated;
    };

    const result = tx
      ? await execute(tx)
      : await this.prisma.$transaction(execute);

    if (status === ClaimStatus.REJECTED) {
      await this.eventBus.emit(DomainEventName.CLAIM_REJECTED, {
        claimId,
        userId: result.policy?.userId,
        beforeState: beforeStateSnapshot,
        afterState: result,
        reason,
      });
    } else if (status === ClaimStatus.APPROVED) {
      await this.eventBus.emit(DomainEventName.CLAIM_APPROVED, {
        claimId: result.id,
        userId: result.policy?.userId ?? '',
        beforeState: beforeStateSnapshot,
        afterState: result,
        reason,
      });
    }

    return result;
  }

  private async runFraudDetection(claim: Claim): Promise<boolean> {
    const fraudIndicators: string[] = [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const duplicateClaims = await this.prisma.claim.count({
      where: {
        policyId: claim.policyId,
        claimAmount: claim.claimAmount,
        status: { not: ClaimStatus.REJECTED },
        id: { not: claim.id },
        createdAt: { gt: thirtyDaysAgo },
      },
    });

    if (duplicateClaims > 0) {
      fraudIndicators.push('DUPLICATE_CLAIM');
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentClaims = await this.prisma.claim.count({
      where: {
        policyId: claim.policyId,
        createdAt: { gt: ninetyDaysAgo },
      },
    });

    if (recentClaims >= 3) {
      fraudIndicators.push('HIGH_FREQUENCY');
    }

    const claimDate = new Date(claim.createdAt);
    const hour = claimDate.getHours();
    const dayOfWeek = claimDate.getDay();

    if (hour < 6 || hour > 22 || dayOfWeek === 0 || dayOfWeek === 6) {
      fraudIndicators.push('UNUSUAL_TIMING');
    }

    if (fraudIndicators.length > 0) {
      this.logger.warn(
        `Fraud indicators detected for claim ${claim.id}: ${fraudIndicators.join(', ')}`,
      );
    }

    return fraudIndicators.length >= 2;
  }

  private async verifyOracle(
    claimId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    try {
      const client = tx ?? this.prisma;
      const claim = (await client.claim.findUnique({
        where: { id: claimId },
        include: { policy: true },
      })) as ClaimWithPolicy | null;
      if (!claim || !claim.policy) return false;

      const policy = claim.policy;
      const now = new Date();
      if (
        policy.status !== PolicyStatus.ACTIVE ||
        (policy.endDate && policy.endDate < now)
      ) {
        return false;
      }

      const claimDecimal = claim.claimAmount as Prisma.Decimal;
      const coverageDecimal = policy.coverageAmount as Prisma.Decimal;

      if (
        claimDecimal.lte(new Prisma.Decimal(0)) ||
        claimDecimal.gt(coverageDecimal)
      ) {
        return false;
      }

      await this.eventBus.emit(DomainEventName.CLAIM_ORACLE_VERIFIED, {
        claimId,
        reason: 'Oracle verification successful',
      });

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Oracle verification failed: ${message}`);
      return false;
    }
  }

  async payClaim(claimId: string): Promise<ClaimWithPolicy> {
    const { updatedClaim, beforeState } = await this.prisma.$transaction(
      async tx => {
        const claim = (await tx.claim.findUnique({
          where: { id: claimId },
          include: { policy: true },
        })) as ClaimWithPolicy | null;
        if (!claim) {
          throw new NotFoundException(`Claim with ID ${claimId} not found`);
        }
        const beforeState = { ...claim };
        const updatedClaim = (await tx.claim.update({
          where: { id: claimId },
          data: { status: ClaimStatus.PAID },
          include: { policy: true },
        })) as ClaimWithPolicy;
        if (claim.policy) {
          const claimDecimal = new Prisma.Decimal(claim.claimAmount);
          await this.pools.unlockCapital(claim.policy.poolId, claimDecimal, tx);
        }
        return { updatedClaim, beforeState };
      },
    );

    await this.eventBus.emit(DomainEventName.CLAIM_PAID, {
      claimId,
      beforeState,
      afterState: updatedClaim,
    });

    return updatedClaim;
  }

  async createClaim(
    policyId: string,
    claimAmount: Prisma.Decimal,
  ): Promise<Claim> {
    const savedClaim = await this.prisma.claim.create({
      data: {
        policyId,
        claimAmount,
        status: ClaimStatus.PENDING,
      },
    });

    await this.eventBus.emit(DomainEventName.CLAIM_CREATED, {
      entityId: savedClaim.id,
      entity: savedClaim,
    });

    return savedClaim;
  }
}
