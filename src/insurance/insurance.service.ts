import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PricingService } from './pricing.service';
import { PoolService } from './pool.service';
import { RiskType } from './enums/risk-type.enum';
import { PolicyStatus } from './enums/policy-status.enum';
import { PrismaService } from '../prisma.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';
import { InsurancePolicy } from '@prisma/client';

@Injectable()
export class InsuranceService {
  private readonly logger = new Logger(InsuranceService.name);

  constructor(
    private readonly pricing: PricingService,
    private readonly pools: PoolService,
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  async purchasePolicy(
    userId: string,
    poolId: string,
    riskType: RiskType,
    coverageAmount: Prisma.Decimal,
  ): Promise<InsurancePolicy> {
    if (!userId || !poolId) {
      throw new BadRequestException('userId and poolId are required');
    }
    if (coverageAmount.lte(new Prisma.Decimal(0))) {
      throw new BadRequestException('Coverage amount must be positive');
    }

    try {
      const created = await this.prisma.$transaction(async tx => {
        const premium = this.pricing.calculatePremium(riskType, coverageAmount);

        await this.pools.lockCapital(poolId, coverageAmount, tx);

        return await tx.insurancePolicy.create({
          data: {
            userId,
            poolId,
            riskType,
            coverageAmount,
            premium,
          },
        });
      });

      await this.eventBus.emit(DomainEventName.POLICY_PURCHASED, {
        entityId: created.id,
        entity: created,
        reason: 'Policy purchased',
      });

      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Purchase policy failed for user ${userId}, pool ${poolId}: ${message}`,
      );
      throw error;
    }
  }

  async cancelPolicy(policyId: string): Promise<InsurancePolicy> {
    const { updated, beforeState } = await this.prisma.$transaction(
      async tx => {
        const policy = await tx.insurancePolicy.findUnique({
          where: { id: policyId },
        });
        if (!policy) {
          throw new BadRequestException(`Policy ${policyId} not found`);
        }
        if (
          policy.status === PolicyStatus.CANCELLED ||
          policy.status === PolicyStatus.EXPIRED
        ) {
          throw new BadRequestException('Policy is already inactive');
        }
        const beforeState = { ...policy };
        const updated = await tx.insurancePolicy.update({
          where: { id: policyId },
          data: { status: PolicyStatus.CANCELLED },
        });
        await this.pools.unlockCapital(
          policy.poolId,
          policy.coverageAmount as Prisma.Decimal,
          tx,
        );
        return { updated, beforeState };
      },
    );

    await this.eventBus.emit(DomainEventName.POLICY_CANCELLED, {
      entityId: policyId,
      beforeState,
      afterState: updated,
      reason: 'Policy cancelled',
    });

    return updated;
  }

  async expirePolicy(policyId: string): Promise<InsurancePolicy> {
    const { updated, beforeState } = await this.prisma.$transaction(
      async tx => {
        const policy = await tx.insurancePolicy.findUnique({
          where: { id: policyId },
        });
        if (!policy) {
          throw new BadRequestException(`Policy ${policyId} not found`);
        }
        if (
          policy.status === PolicyStatus.EXPIRED ||
          policy.status === PolicyStatus.CANCELLED
        ) {
          throw new BadRequestException('Policy is already inactive');
        }
        const beforeState = { ...policy };
        const updated = await tx.insurancePolicy.update({
          where: { id: policyId },
          data: { status: PolicyStatus.EXPIRED },
        });
        await this.pools.unlockCapital(
          policy.poolId,
          policy.coverageAmount as Prisma.Decimal,
          tx,
        );
        return { updated, beforeState };
      },
    );

    await this.eventBus.emit(DomainEventName.POLICY_EXPIRED, {
      entityId: policyId,
      beforeState,
      afterState: updated,
      reason: 'Policy expired',
    });

    return updated;
  }
}
