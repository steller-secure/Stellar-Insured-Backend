import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SoftDeleteRepository } from '../repositories/soft-delete.repository';
import { TransactionClient } from '../repositories/repository.interface';

export type UserWithSettings = User & {
  notificationSettings?: {
    emailEnabled: boolean;
    pushEnabled: boolean;
    notifyContributions: boolean;
    notifyMilestones: boolean;
    notifyDeadlines: boolean;
  } | null;
};

@Injectable()
export class UserRepository extends SoftDeleteRepository<User> {
  constructor(prisma: PrismaService) {
    super(prisma, 'user');
  }

  async findByIdActive(id: string, tx?: TransactionClient): Promise<User | null> {
    return this.delegate(tx).findFirst({ where: { id, deletedAt: null } });
  }

  async findByWallet(walletAddress: string, tx?: TransactionClient): Promise<User | null> {
    return this.delegate(tx).findFirst({ where: { walletAddress, deletedAt: null } });
  }

  async findByWalletUnique(walletAddress: string, tx?: TransactionClient): Promise<User | null> {
    return this.delegate(tx).findUnique({ where: { walletAddress } });
  }

  async findPaginated(
    offset: number,
    limit: number,
    tx?: TransactionClient,
  ): Promise<User[]> {
    return this.delegate(tx).findMany({
      where: { deletedAt: null },
      skip: offset,
      take: limit,
    });
  }

  async countActive(tx?: TransactionClient): Promise<number> {
    return this.delegate(tx).count({ where: { deletedAt: null } });
  }

  async findWithSettings(
    id: string,
    tx?: TransactionClient,
  ): Promise<UserWithSettings | null> {
    return this.delegate(tx).findFirst({
      where: { id, deletedAt: null },
      include: { notificationSettings: true },
    });
  }

  async createWithSettings(
    data: Prisma.UserCreateInput,
    tx?: TransactionClient,
  ): Promise<UserWithSettings> {
    return this.delegate(tx).create({
      data,
      include: { notificationSettings: true },
    });
  }

  async updateUser(
    id: string,
    data: Prisma.UserUpdateInput,
    tx?: TransactionClient,
  ): Promise<User> {
    return this.delegate(tx).update({ where: { id }, data });
  }

  async upsertByWallet(
    walletAddress: string,
    createData: Prisma.UserCreateInput,
    updateData: Prisma.UserUpdateInput,
    tx?: TransactionClient,
  ): Promise<User> {
    return this.delegate(tx).upsert({
      where: { walletAddress },
      create: createData,
      update: updateData,
    });
  }

  /** Cascade soft-delete of a user and all their related records. */
  async cascadeSoftDelete(
    id: string,
    deletedAt: Date,
    tx?: TransactionClient,
  ): Promise<User> {
    const client: any = tx ?? this.prisma;
    const [user] = await this.prisma.$transaction([
      client.user.update({ where: { id }, data: { deletedAt } }),
      client.notification.updateMany({ where: { userId: id }, data: { deletedAt } }),
      client.notificationSetting.updateMany({ where: { userId: id }, data: { deletedAt } }),
      client.insurancePolicy.updateMany({ where: { userId: id }, data: { deletedAt } }),
      client.claim.updateMany({ where: { policy: { userId: id } }, data: { deletedAt } }),
    ]);
    return user as User;
  }
}
