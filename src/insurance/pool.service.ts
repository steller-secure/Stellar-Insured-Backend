import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InsurancePoolRepository } from '../common/repositories/insurance-pool.repository';
import { AuditService } from './services/audit.service';
import { TransactionClient } from '../common/repositories/repository.interface';

@Injectable()
export class PoolService {
  constructor(
    private readonly poolRepository: InsurancePoolRepository,
    private readonly auditService: AuditService,
  ) {}

  async addCapital(poolId: string, amount: Prisma.Decimal, tx?: TransactionClient) {
    if (amount.lte(new Prisma.Decimal(0))) {
      throw new BadRequestException('Amount must be positive');
    }
    const pool = await this.poolRepository.findByIdRequired(poolId, tx);
    if (!pool) {
      throw new NotFoundException(`Pool ${poolId} not found`);
    }
    const beforeState = { ...pool };
    const updatedPool = await this.poolRepository.incrementCapital(poolId, amount, tx);
    await this.auditService.logAddCapital('InsurancePool', poolId, beforeState, updatedPool, undefined, undefined, tx);
    return updatedPool;
  }

  async lockCapital(poolId: string, amount: Prisma.Decimal, tx?: TransactionClient) {
    if (amount.lte(new Prisma.Decimal(0))) {
      throw new BadRequestException('Amount must be positive');
    }
    const pool = await this.poolRepository.findByIdRequired(poolId, tx);
    if (!pool) {
      throw new NotFoundException(`Pool ${poolId} not found`);
    }
    const beforeState = { ...pool };
    const updatedPool = await this.poolRepository.incrementLockedCapital(poolId, amount, tx);
    await this.auditService.logUpdate('InsurancePool', poolId, beforeState, updatedPool, undefined, undefined, tx);
    return updatedPool;
  }

  async unlockCapital(poolId: string, amount: Prisma.Decimal, tx?: TransactionClient) {
    if (amount.lte(new Prisma.Decimal(0))) {
      throw new BadRequestException('Amount must be positive');
    }
    const pool = await this.poolRepository.findByIdRequired(poolId, tx);
    if (!pool) {
      throw new NotFoundException(`Pool ${poolId} not found`);
    }
    const beforeState = { ...pool };
    const updatedPool = await this.poolRepository.decrementLockedCapital(poolId, amount, tx);
    const availableCapital = new Prisma.Decimal(updatedPool.capital).minus(
      new Prisma.Decimal(updatedPool.lockedCapital),
    );
    if (availableCapital.lt(new Prisma.Decimal(0))) {
      throw new BadRequestException('Unlocking capital would violate availableCapital invariant');
    }
    await this.auditService.logUnlockCapital('InsurancePool', poolId, beforeState, updatedPool, undefined, undefined, tx);
    return updatedPool;
  }
}
