import { Injectable } from '@nestjs/common';
import { Notification, NotificationSetting, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SoftDeleteRepository } from '../repositories/soft-delete.repository';
import { TransactionClient } from '../repositories/repository.interface';

@Injectable()
export class NotificationRepository extends SoftDeleteRepository<Notification> {
  constructor(prisma: PrismaService) {
    super(prisma, 'notification');
  }

  async createNotification(
    data: Prisma.NotificationUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<Notification> {
    return this.delegate(tx).create({ data });
  }

  async updateMany(
    where: Prisma.NotificationWhereInput,
    data: Prisma.NotificationUpdateManyMutationInput,
    tx?: TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    return this.delegate(tx).updateMany({ where, data });
  }
}

@Injectable()
export class NotificationSettingRepository extends SoftDeleteRepository<NotificationSetting> {
  constructor(prisma: PrismaService) {
    super(prisma, 'notificationSetting');
  }

  async findByUserId(userId: string, tx?: TransactionClient): Promise<NotificationSetting | null> {
    return this.delegate(tx).findUnique({ where: { userId } });
  }

  async upsertForUser(userId: string, tx?: TransactionClient): Promise<NotificationSetting> {
    return this.delegate(tx).upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateMany(
    where: Prisma.NotificationSettingWhereInput,
    data: Prisma.NotificationSettingUpdateManyMutationInput,
    tx?: TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    return this.delegate(tx).updateMany({ where, data });
  }
}

@Injectable()
export class EmailOutboxRepository extends SoftDeleteRepository<
  import('@prisma/client').EmailOutbox
> {
  constructor(prisma: PrismaService) {
    super(prisma, 'emailOutbox');
  }

  async createOutbox(
    data: Prisma.EmailOutboxCreateInput | Prisma.EmailOutboxUncheckedCreateInput,
    tx?: TransactionClient,
  ): Promise<import('@prisma/client').EmailOutbox> {
    return this.delegate(tx).create({ data });
  }

  async updateStatus(
    id: string,
    data: Prisma.EmailOutboxUpdateInput,
    tx?: TransactionClient,
  ): Promise<import('@prisma/client').EmailOutbox> {
    return this.delegate(tx).update({ where: { id }, data });
  }

  async findPendingBatch(
    limit: number,
    maxAttempts: number,
    tx?: TransactionClient,
  ): Promise<import('@prisma/client').EmailOutbox[]> {
    return this.delegate(tx).findMany({
      where: { status: 'PENDING', attempts: { lt: maxAttempts } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}
