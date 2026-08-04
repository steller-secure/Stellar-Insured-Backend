import { Injectable } from '@nestjs/common';
import { InsurancePool, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SoftDeleteRepository } from '../repositories/soft-delete.repository';
import { TransactionClient } from '../repositories/repository.interface';

@Injectable()
export class InsurancePoolRepository extends SoftDeleteRepository<InsurancePool> {
  constructor(prisma: PrismaService) {
    super(prisma, 'insurancePool');
  }

  async findByIdRequired(id: string, tx?: TransactionClient): Promise<InsurancePool | null> {
    return this.delegate(tx).findUnique({ where: { id } });
  }

  async incrementCapital(
    id: string,
    amount: Prisma.Decimal,
    tx?: TransactionClient,
  ): Promise<InsurancePool> {
    return this.delegate(tx).update({
      where: { id },
      data: { capital: { increment: amount } },
    });
  }

  async incrementLockedCapital(
    id: string,
    amount: Prisma.Decimal,
    tx?: TransactionClient,
  ): Promise<InsurancePool> {
    return this.delegate(tx).update({
      where: { id },
      data: { lockedCapital: { increment: amount } },
    });
  }

  async decrementLockedCapital(
    id: string,
    amount: Prisma.Decimal,
    tx?: TransactionClient,
  ): Promise<InsurancePool> {
    return this.delegate(tx).update({
      where: { id },
      data: { lockedCapital: { decrement: amount } },
    });
  }
}
