import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '../../../src/modules/notification/notification.service';
import {
  Notification,
  NotificationType,
} from '../../../src/modules/notification/notification.entity';
import { CreateNotificationDto } from '../../../src/modules/notification/dto/create-notification.dto';
import { UpdateNotificationReadStatusDto } from '../../../src/modules/notification/dto/update-notification-read-status.dto';
import { PaginationDto } from '../../../src/modules/notification/dto/pagination.dto';

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: Repository<Notification>;

  const mockNotificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a notification', async () => {
      const createDto: CreateNotificationDto = {
        userId: 'user-id',
        type: NotificationType.CLAIM,
        title: 'Test Notification',
        message: 'Test Message',
        metadata: { test: 'data' },
      };

      const notificationEntity = new Notification();
      Object.assign(notificationEntity, createDto);

      mockNotificationRepository.create.mockReturnValue(notificationEntity);
      mockNotificationRepository.save.mockResolvedValue(notificationEntity);

      const result = await service.create(createDto);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockNotificationRepository.save).toHaveBeenCalledWith(
        notificationEntity,
      );
      expect(result).toEqual(notificationEntity);
    });
  });

  describe('findAllByUserId', () => {
    it('should return paginated notifications for a user', async () => {
      const userId = 'user-id';
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const notifications = [new Notification()];
      const totalCount = 1;

      mockNotificationRepository.findAndCount.mockResolvedValue([
        notifications,
        totalCount,
      ]);

      const result = await service.findAllByUserId(userId, paginationDto);

      expect(mockNotificationRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({ notifications, totalCount });
    });
  });

  describe('findOne', () => {
    it('should return a notification when found', async () => {
      const id = 'notification-id';
      const userId = 'user-id';
      const notification = new Notification();
      notification.id = id;
      notification.userId = userId;

      mockNotificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.findOne(id, userId);

      expect(mockNotificationRepository.findOne).toHaveBeenCalledWith({
        where: { id, userId },
      });
      expect(result).toEqual(notification);
    });

    it('should throw NotFoundException when notification not found', async () => {
      const id = 'non-existent-id';
      const userId = 'user-id';

      mockNotificationRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(id, userId)).rejects.toThrow(
        `Notification with ID ${id} not found`,
      );
    });
  });

  describe('updateReadStatus', () => {
    it('should update notification read status', async () => {
      const id = 'notification-id';
      const userId = 'user-id';
      const updateDto: UpdateNotificationReadStatusDto = { isRead: true };
      const notification = new Notification();
      notification.id = id;
      notification.userId = userId;
      notification.isRead = false;

      mockNotificationRepository.findOne.mockResolvedValue(notification);
      mockNotificationRepository.save.mockResolvedValue({
        ...notification,
        isRead: true,
      });

      const result = await service.updateReadStatus(id, userId, updateDto);

      expect(mockNotificationRepository.findOne).toHaveBeenCalledWith({
        where: { id, userId },
      });
      expect(mockNotificationRepository.save).toHaveBeenCalled();
      expect(result.isRead).toBe(true);
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      const userId = 'user-id';
      const count = 5;

      mockNotificationRepository.count.mockResolvedValue(count);

      const result = await service.getUnreadCount(userId);

      expect(mockNotificationRepository.count).toHaveBeenCalledWith({
        where: { userId, isRead: false },
      });
      expect(result).toBe(count);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const userId = 'user-id';
      const affectedRows = 3;

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: affectedRows }),
      };

      mockNotificationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.markAllAsRead(userId);

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        isRead: true,
        updatedAt: expect.any(Date),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'userId = :userId AND isRead = false',
        { userId },
      );
      expect(result).toBe(affectedRows);
    });
  });

  describe('utility methods', () => {
    it('should create claim notification', async () => {
      const userId = 'user-id';
      const claimId = 'claim-id';
      const title = 'Claim Update';
      const message = 'Your claim has been processed';

      const createSpy = jest.spyOn(service, 'create');

      await service.createClaimNotification(userId, claimId, title, message);

      expect(createSpy).toHaveBeenCalledWith({
        userId,
        type: NotificationType.CLAIM,
        title,
        message,
        metadata: { claimId },
      });
    });

    it('should create policy notification', async () => {
      const userId = 'user-id';
      const policyId = 'policy-id';
      const title = 'Policy Update';
      const message = 'Your policy has been renewed';

      const createSpy = jest.spyOn(service, 'create');

      await service.createPolicyNotification(userId, policyId, title, message);

      expect(createSpy).toHaveBeenCalledWith({
        userId,
        type: NotificationType.POLICY,
        title,
        message,
        metadata: { policyId },
      });
    });

    it('should create DAO notification', async () => {
      const userId = 'user-id';
      const proposalId = 'proposal-id';
      const title = 'DAO Proposal';
      const message = 'New DAO proposal available';

      const createSpy = jest.spyOn(service, 'create');

      await service.createDaoNotification(userId, proposalId, title, message);

      expect(createSpy).toHaveBeenCalledWith({
        userId,
        type: NotificationType.DAO,
        title,
        message,
        metadata: { proposalId },
      });
    });

    it('should create system notification', async () => {
      const userId = 'user-id';
      const title = 'System Maintenance';
      const message = 'Scheduled maintenance';

      const createSpy = jest.spyOn(service, 'create');

      await service.createSystemNotification(userId, title, message);

      expect(createSpy).toHaveBeenCalledWith({
        userId,
        type: NotificationType.SYSTEM,
        title,
        message,
        metadata: undefined,
      });
    });
  });
});
