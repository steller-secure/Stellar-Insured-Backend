import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';

@Injectable()
export class ReinsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  async createContract(
    poolId: string,
    coverageLimit: Prisma.Decimal,
    premiumRate: Prisma.Decimal,
  ) {
    const savedContract = await this.prisma.$transaction(async tx => {
      return await tx.reinsuranceContract.create({
        data: { poolId, coverageLimit, premiumRate },
      });
    });

    await this.eventBus.emit(DomainEventName.REINSURANCE_CONTRACT_CREATED, {
      contractId: savedContract.id,
      entity: savedContract,
    });

    return savedContract;
  }

  async releaseContract(contractId: string) {
    const { released, beforeState } = await this.prisma.$transaction(
      async tx => {
        const existing = await tx.reinsuranceContract.findUnique({
          where: { id: contractId },
        });
        if (!existing) {
          throw new BadRequestException(
            `Reinsurance contract ${contractId} not found`,
          );
        }
        const beforeState = { ...existing };
        const released = await tx.reinsuranceContract.delete({
          where: { id: contractId },
        });
        return { released, beforeState };
      },
    );

    await this.eventBus.emit(DomainEventName.REINSURANCE_CONTRACT_RELEASED, {
      contractId,
      beforeState,
      reason: 'Reinsurance contract released',
    });

    return released;
  }
}
