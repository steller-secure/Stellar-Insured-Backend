import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ClaimStatus } from './enums/claim-status.enum';
import { PolicyStatus } from './enums/policy-status.enum';
import { AuditAction } from './enums/audit-action.enum';
import { PoolService } from './pool.service';
import { AuditService } from './services/audit.service';
import { ReputationService } from '../reputation/reputation.service';
import { REPUTATION_DELTAS } from '../reputation/reputation.constants';
import { Claim, InsurancePolicy, Prisma } from '@prisma/client';
import { ClaimRepository, ClaimWithPolicy } from '../common/repositories/claim.repository';
import { PrismaService } from '../prisma.service';
import { TransactionClient } from '../common/repositories/repository.interface';
import { updateTracingContext } from '../common/tracing/tracing-context';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';

@Injectable()
export class ClaimService {
  private readonly logger = new Logger(ClaimService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pools: PoolService,
    private readonly auditService: AuditService,
    private readonly reputationService: ReputationService,
    private readonly claimRepository: ClaimRepository,
    private readonly eventBus: DomainEventBus,
  ) {}

  async assessClaim(claimId: string): Promise<ClaimWithPolicy> {
    const claim = await this.claimRepository.findByIdWithPolicy(claimId);
    if (!claim) throw new NotFoundException(`Claim with ID ${claimId} not found`);
    updateTracingContext({ entityId: claimId });

    const policy = claim.policy;
    if (!policy) throw new NotFoundException(`Policy for claim ${claimId} not found`);

    // If claim is already assessed (approved/rejected/paid), return it without performing any mutations (idempotent operation)
    if (claim.status !== ClaimStatus.PENDING) {
      return claim as ClaimWithPolicy;
    }

    const beforeState = { ...claim };

    if (policy.status !== PolicyStatus.ACTIVE) {
      const reason = `Policy is not active: ${policy.status}`;
      await this.updateStatus(claimId, ClaimStatus.REJECTED, reason, 'system');
      throw new BadRequestException('Cannot approve claim for inactive policy');
    }

    if ((claim.claimAmount as Prisma.Decimal).gt(policy.coverageAmount as Prisma.Decimal)) {
      const reason = 'Claim amount exceeds coverage';
      await this.updateStatus(claimId, ClaimStatus.REJECTED, reason, 'system');
      throw new BadRequestException('Claim amount exceeds policy coverage amount');
    }

    const isFraudulent = await this.runFraudDetection(claim);
    if (isFraudulent) {
      this.logger.warn(`Fraud detection triggered for claim ${claimId}`);
      await this.auditService.log(
        AuditAction.FRAUD_DETECTED,
        'Claim',
        claimId,
        beforeState,
        claim,
        undefined,
        'High fraud risk score detected',
      );
      await this.eventBus.emit(DomainEventName.CLAIM_FRAUD_DETECTED, {
        claimId,
        userId: policy.userId,
        beforeState,
        afterState: claim,
        reason: 'High fraud risk score detected',
      });
      await this.reputationService.adjustReputation(
        policy.userId,
        REPUTATION_DELTAS.FRAUD_DETECTED,
        `Fraud detected on claim ${claimId}`,
      );
    }

    const oracleVerified = await this.verifyOracle(claimId);
    if (!oracleVerified) {
      const reason = 'Oracle verification failed';
      await this.updateStatus(claimId, ClaimStatus.REJECTED, reason, 'system');
      throw new BadRequestException('Oracle verification failed');
    }

    const updatedClaim = await this.prisma.$transaction(async tx => {
      const result = await this.claimRepository.updateStatusWithPolicy(
        claimId,
        ClaimStatus.APPROVED,
        { payoutAmount: claim.claimAmount },
        tx,
      );
      await this.auditService.logApprove('Claim', claimId, beforeState, result);
      return result;
    });

    await this.eventBus.emit(DomainEventName.CLAIM_APPROVED, {
      claimId: updatedClaim.id,
      userId: policy.userId,
      beforeState,
      afterState: updatedClaim,
      reason: 'Claim approved',
    });
    await this.reputationService.adjustReputation(
      policy.userId,
      REPUTATION_DELTAS.CLAIM_APPROVED,
      `Claim ${claimId} approved`,
    );

    return updatedClaim;
  }

  private async updateStatus(
    claimId: string,
    status: ClaimStatus,
    reason: string,
    _user: string = 'system',
    additionalData: { payoutAmount?: Prisma.Decimal } = {},
    tx?: TransactionClient,
  ): Promise<ClaimWithPolicy> {
    const execute = async (client: TransactionClient) => {
      const existing = await this.claimRepository.findByIdWithPolicy(claimId, client);
      if (!existing) throw new NotFoundException('Claim not found');

      const beforeState = { ...existing };
      const updated = await this.claimRepository.updateStatusWithPolicy(
        claimId,
        status,
        additionalData.payoutAmount !== undefined ? { payoutAmount: additionalData.payoutAmount } : {},
        client,
      );

      if (status === ClaimStatus.REJECTED) {
        if (existing.policy) {
          const claimDecimal = new Prisma.Decimal(existing.claimAmount);
          await this.pools.unlockCapital(existing.policy.poolId, claimDecimal, tx);
        }
        await this.auditService.logReject('Claim', claimId, beforeState, updated, reason, client);
      } else if (status === ClaimStatus.APPROVED) {
        await this.auditService.logApprove('Claim', updated.id, beforeState, updated, undefined, reason, client);
      }

      return updated;
    };

    const result = tx ? await execute(tx) : await this.prisma.$transaction(execute);

    if (status === ClaimStatus.REJECTED) {
      await this.eventBus.emit(DomainEventName.CLAIM_REJECTED, {
        claimId,
        userId: result.policy?.userId,
        beforeState: { ...result },
        afterState: result,
        reason,
      });
      const userId = result.policy?.userId;
      if (userId) {
        try {
          await this.reputationService.adjustReputation(
            userId,
            REPUTATION_DELTAS.CLAIM_REJECTED,
            `Claim ${claimId} rejected: ${reason}`,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Failed to adjust reputation for claim rejection ${claimId}: ${msg}`);
        }
      }
    }

    return result;
  }

  private async runFraudDetection(claim: Claim): Promise<boolean> {
    const fraudIndicators: string[] = [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const duplicateClaims = await this.claimRepository.countDuplicates(
      claim.policyId,
      claim.claimAmount as Prisma.Decimal,
      claim.id,
      thirtyDaysAgo,
      ClaimStatus.REJECTED,
    );
    if (duplicateClaims > 0) fraudIndicators.push('DUPLICATE_CLAIM');

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentClaims = await this.claimRepository.countRecent(claim.policyId, ninetyDaysAgo);
    if (recentClaims >= 3) fraudIndicators.push('HIGH_FREQUENCY');

    const claimDate = new Date(claim.createdAt);
    const hour = claimDate.getHours();
    const dayOfWeek = claimDate.getDay();
    if (hour < 6 || hour > 22 || dayOfWeek === 0 || dayOfWeek === 6) {
      fraudIndicators.push('UNUSUAL_TIMING');
    }

    if (fraudIndicators.length > 0) {
      this.logger.warn(`Fraud indicators detected for claim ${claim.id}: ${fraudIndicators.join(', ')}`);
    }

    return fraudIndicators.length >= 2;
  }

  private async verifyOracle(claimId: string, tx?: TransactionClient): Promise<boolean> {
    try {
      const claim = await this.claimRepository.findByIdWithPolicy(claimId, tx);
      if (!claim || !claim.policy) return false;

      const policy = claim.policy as InsurancePolicy;
      const now = new Date();
      if (policy.status !== PolicyStatus.ACTIVE || (policy.endDate && policy.endDate < now)) {
        return false;
      }

      const claimDecimal = claim.claimAmount as Prisma.Decimal;
      const coverageDecimal = policy.coverageAmount as Prisma.Decimal;
      if (claimDecimal.lte(new Prisma.Decimal(0)) || claimDecimal.gt(coverageDecimal)) {
        return false;
      }

      await this.auditService.log(
        AuditAction.ORACLE_VERIFIED,
        'Claim',
        claimId,
        undefined,
        undefined,
        undefined,
        'Oracle verification successful',
        tx,
      );

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Oracle verification failed: ${message}`);
      return false;
    }
  }

  async payClaim(claimId: string): Promise<ClaimWithPolicy> {
    updateTracingContext({ entityId: claimId });
    return await this.prisma.$transaction(async tx => {
      const claim = (await tx.claim.findUnique({
        where: { id: claimId },
        include: { policy: true },
      })) as ClaimWithPolicy | null;
      if (!claim) {
        throw new NotFoundException(`Claim with ID ${claimId} not found`);
      }
      // If claim is already paid, return it without performing any mutations (idempotent operation)
      if (claim.status === ClaimStatus.PAID) {
        return claim as ClaimWithPolicy;
      }
      const beforeState = { ...claim };
      const updatedClaim = await this.claimRepository.updateStatusWithPolicy(
        claimId,
        ClaimStatus.PAID,
        {},
        tx,
      );
      if (claim.policy) {
        const claimDecimal = new Prisma.Decimal(claim.claimAmount);
        await this.pools.unlockCapital(claim.policy.poolId, claimDecimal, tx);
      }
      await this.auditService.logPayout('Claim', claimId, beforeState, updatedClaim, undefined, undefined, tx);
      return updatedClaim;
    });
  }

  async createClaim(policyId: string, claimAmount: Prisma.Decimal): Promise<Claim> {
    const savedClaim = await this.claimRepository.createClaim({
      policyId,
      claimAmount,
      status: ClaimStatus.PENDING,
    });
    updateTracingContext({ entityId: savedClaim.id });
    await this.auditService.logCreate('Claim', savedClaim.id, savedClaim);
    await this.eventBus.emit(DomainEventName.CLAIM_CREATED, {
      entityId: savedClaim.id,
      entity: savedClaim,
    });
    return savedClaim;
  }
}