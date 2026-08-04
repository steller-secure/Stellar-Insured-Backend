import { Injectable } from '@nestjs/common';
import { Prisma, InsurancePolicy } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SoftDeleteRepository } from '../repositories/soft-delete.repository';
import { TransactionClient } from '../repositories/repository.interface';

@Injectable()
export class InsurancePolicyRepository extends SoftDeleteRepository<InsurancePolicy> {
  constructor(prisma: PrismaService) {
    super(prisma, 'insurancePolicy');
  }

  async findByIdWithRelations(
    id: string,
    tx?: TransactionClient,
  ): Promise<(InsurancePolicy & { policy?: InsurancePolicy }) | null> {
    return this.delegate(tx).findUnique({ where: { id } });
  }

  async createPolicy(
    data: Prisma.InsurancePolicyCreateInput | Prisma.InsurancePolicyUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<InsurancePolicy> {
    return this.delegate(tx).create({ data });
  }

  async updateStatus(
    id: string,
    status: string,
    tx?: TransactionClient,
  ): Promise<InsurancePolicy> {
    return this.delegate(tx).update({ where: { id }, data: { status } });
  }

  async updateMany(
    where: Prisma.InsurancePolicyWhereInput,
    data: Prisma.InsurancePolicyUpdateManyMutationInput,
    tx?: TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    return this.delegate(tx).updateMany({ where, data });
  }
}
