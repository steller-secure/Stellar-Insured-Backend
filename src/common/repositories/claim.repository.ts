import { Injectable } from '@nestjs/common';
import { Claim, InsurancePolicy, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SoftDeleteRepository } from '../repositories/soft-delete.repository';
import { TransactionClient } from '../repositories/repository.interface';

export type ClaimWithPolicy = Claim & { policy: InsurancePolicy };

@Injectable()
export class ClaimRepository extends SoftDeleteRepository<Claim> {
  constructor(prisma: PrismaService) {
    super(prisma, 'claim');
  }

  async findByIdWithPolicy(
    id: string,
    tx?: TransactionClient,
  ): Promise<ClaimWithPolicy | null> {
    return this.delegate(tx).findUnique({
      where: { id },
      include: { policy: true },
    }) as Promise<ClaimWithPolicy | null>;
  }

  async createClaim(
    data: Prisma.ClaimUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<Claim> {
    return this.delegate(tx).create({ data });
  }

  async updateStatus(
    id: string,
    status: string,
    extra: Record<string, unknown> = {},
    tx?: TransactionClient,
  ): Promise<Claim> {
    return this.delegate(tx).update({ where: { id }, data: { status, ...extra } });
  }

  async updateStatusWithPolicy(
    id: string,
    status: string,
    extra: Record<string, unknown> = {},
    tx?: TransactionClient,
  ): Promise<ClaimWithPolicy> {
    return this.delegate(tx).update({
      where: { id },
      data: { status, ...extra },
      include: { policy: true },
    }) as Promise<ClaimWithPolicy>;
  }

  async countDuplicates(
    policyId: string,
    claimAmount: Prisma.Decimal,
    excludeId: string,
    since: Date,
    excludeStatus: string,
    tx?: TransactionClient,
  ): Promise<number> {
    return this.delegate(tx).count({
      where: {
        policyId,
        claimAmount,
        status: { not: excludeStatus },
        id: { not: excludeId },
        createdAt: { gt: since },
      },
    });
  }

  async countRecent(
    policyId: string,
    since: Date,
    tx?: TransactionClient,
  ): Promise<number> {
    return this.delegate(tx).count({
      where: { policyId, createdAt: { gt: since } },
    });
  }

  async updateMany(
    where: Prisma.ClaimWhereInput,
    data: Prisma.ClaimUpdateManyMutationInput,
    tx?: TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    return this.delegate(tx).updateMany({ where, data });
  }
}
