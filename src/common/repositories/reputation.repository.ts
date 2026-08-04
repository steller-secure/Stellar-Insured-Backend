import { Injectable } from '@nestjs/common';
import { ReputationHistory, User, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SoftDeleteRepository } from '../repositories/soft-delete.repository';
import { TransactionClient } from '../repositories/repository.interface';

@Injectable()
export class ReputationRepository extends SoftDeleteRepository<ReputationHistory> {
  constructor(prisma: PrismaService) {
    super(prisma, 'reputationHistory');
  }

  async createHistory(
    data: Prisma.ReputationHistoryUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<ReputationHistory> {
    return this.delegate(tx).create({ data });
  }

  /** Read the current reputation score and update it atomically inside a tx. */
  async findUserScore(
    userId: string,
    tx?: TransactionClient,
  ): Promise<Pick<User, 'reputationScore'> | null> {
    const client: any = tx ?? this.prisma;
    return client.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });
  }

  async updateUserScore(
    userId: string,
    reputationScore: number,
    tx?: TransactionClient,
  ): Promise<User> {
    const client: any = tx ?? this.prisma;
    return client.user.update({
      where: { id: userId },
      data: { reputationScore },
    });
  }

  async updateTrustScore(
    userId: string,
    trustScore: number,
    tx?: TransactionClient,
  ): Promise<User> {
    const client: any = tx ?? this.prisma;
    return client.user.update({
      where: { id: userId },
      data: { trustScore },
    });
  }
}
