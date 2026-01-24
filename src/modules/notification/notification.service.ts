import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationReadStatusDto } from './dto/update-notification-read-status.dto';
import { PaginationDto } from './dto/pagination.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create(
      createNotificationDto,
    );
    return await this.notificationRepository.save(notification);
  }

  async findAllByUserId(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<{ notifications: Notification[]; totalCount: number }> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [notifications, totalCount] =
      await this.notificationRepository.findAndCount({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });

    return { notifications, totalCount };
  }

  async findOne(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  async updateReadStatus(
    id: string,
    userId: string,
    updateDto: UpdateNotificationReadStatusDto,
  ): Promise<Notification> {
    const notification = await this.findOne(id, userId);

    notification.isRead = updateDto.isRead;
    notification.updatedAt = new Date();

    return await this.notificationRepository.save(notification);
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    return await this.updateReadStatus(id, userId, { isRead: true });
  }

  async markAsUnread(id: string, userId: string): Promise<Notification> {
    return await this.updateReadStatus(id, userId, { isRead: false });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const notification = await this.findOne(id, userId);
    await this.notificationRepository.remove(notification);
  }

  // Bulk operations
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, updatedAt: new Date() })
      .where('userId = :userId AND isRead = false', { userId })
      .execute();

    return result.affected || 0;
  }

  async createBulk(
    notifications: CreateNotificationDto[],
  ): Promise<Notification[]> {
    const notificationEntities =
      this.notificationRepository.create(notifications);
    return await this.notificationRepository.save(notificationEntities);
  }

  // Utility methods
  async createClaimNotification(
    userId: string,
    claimId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    return await this.create({
      userId,
      type: NotificationType.CLAIM,
      title,
      message,
      metadata: {
        claimId,
        ...metadata,
      },
    });
  }

  async createPolicyNotification(
    userId: string,
    policyId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    return await this.create({
      userId,
      type: NotificationType.POLICY,
      title,
      message,
      metadata: {
        policyId,
        ...metadata,
      },
    });
  }

  async createDaoNotification(
    userId: string,
    proposalId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    return await this.create({
      userId,
      type: NotificationType.DAO,
      title,
      message,
      metadata: {
        proposalId,
        ...metadata,
      },
    });
  }

  async createSystemNotification(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    return await this.create({
      userId,
      type: NotificationType.SYSTEM,
      title,
      message,
      metadata,
    });
  }
}
