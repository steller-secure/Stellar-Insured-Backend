import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';

@Injectable()
export class PoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  async addCapital(
    poolId: string,
    amount: Prisma.Decimal,
    tx?: Prisma.TransactionClient,
  ) {
    if (amount.lte(new Prisma.Decimal(0))) {
      throw new BadRequestException('Amount must be positive');
    }
    const client = tx ?? this.prisma;
    const pool = await client.insurancePool.findUnique({
      where: { id: poolId },
    });
    if (!pool) {
      throw new NotFoundException(`Pool ${poolId} not found`);
    }
    const beforeState = { ...pool };
    const updatedPool = await client.insurancePool.update({
      where: { id: poolId },
      data: { capital: { increment: amount } },
    });

    await this.eventBus.emit(DomainEventName.POOL_CAPITAL_ADDED, {
      poolId,
      beforeState,
      afterState: updatedPool,
    });

    return updatedPool;
  }

  async lockCapital(
    poolId: string,
    amount: Prisma.Decimal,
    tx?: Prisma.TransactionClient,
  ) {
    if (amount.lte(new Prisma.Decimal(0))) {
      throw new BadRequestException('Amount must be positive');
    }
    const client = tx ?? this.prisma;
    const pool = await client.insurancePool.findUnique({
      where: { id: poolId },
    });
    if (!pool) {
      throw new NotFoundException(`Pool ${poolId} not found`);
    }
    const beforeState = { ...pool };
    const updatedPool = await client.insurancePool.update({
      where: { id: poolId },
      data: { lockedCapital: { increment: amount } },
    });

    await this.eventBus.emit(DomainEventName.POOL_CAPITAL_LOCKED, {
      poolId,
      beforeState,
      afterState: updatedPool,
    });

    return updatedPool;
  }

  async unlockCapital(
    poolId: string,
    amount: Prisma.Decimal,
    tx?: Prisma.TransactionClient,
  ) {
    if (amount.lte(new Prisma.Decimal(0))) {
      throw new BadRequestException('Amount must be positive');
    }
    const client = tx ?? this.prisma;
    const pool = await client.insurancePool.findUnique({
      where: { id: poolId },
    });
    if (!pool) {
      throw new NotFoundException(`Pool ${poolId} not found`);
    }
    const beforeState = { ...pool };
    const updatedPool = await client.insurancePool.update({
      where: { id: poolId },
      data: { lockedCapital: { decrement: amount } },
    });
    const availableCapital = new Prisma.Decimal(updatedPool.capital).minus(
      new Prisma.Decimal(updatedPool.lockedCapital),
    );
    if (availableCapital.lt(new Prisma.Decimal(0))) {
      throw new BadRequestException(
        'Unlocking capital would violate availableCapital invariant',
      );
    }

    await this.eventBus.emit(DomainEventName.POOL_CAPITAL_UNLOCKED, {
      poolId,
      beforeState,
      afterState: updatedPool,
    });

    return updatedPool;
  }
}
