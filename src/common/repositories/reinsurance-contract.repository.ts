import { Injectable } from '@nestjs/common';
import { ReinsuranceContract, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SoftDeleteRepository } from '../repositories/soft-delete.repository';
import { TransactionClient } from '../repositories/repository.interface';

@Injectable()
export class ReinsuranceContractRepository extends SoftDeleteRepository<ReinsuranceContract> {
  constructor(prisma: PrismaService) {
    super(prisma, 'reinsuranceContract');
  }

  async createContract(
    data: Prisma.ReinsuranceContractUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<ReinsuranceContract> {
    return this.delegate(tx).create({ data });
  }

  async findByIdStrict(
    id: string,
    tx?: TransactionClient,
  ): Promise<ReinsuranceContract | null> {
    return this.delegate(tx).findUnique({ where: { id } });
  }

  async deleteContract(id: string, tx?: TransactionClient): Promise<ReinsuranceContract> {
    return this.delegate(tx).delete({ where: { id } });
  }
}
