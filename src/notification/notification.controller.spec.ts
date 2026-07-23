import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { PrismaService } from '../prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { NotificationService } from './services/notification.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';

const prisma = {
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  notificationSetting: {
    upsert: jest.fn(),
  },
};

const encryption = {
  encrypt: jest.fn((value: string) => `encrypted:${value}`),
};

const notificationService = {
  notify: jest.fn(),
};

const eventBus = {
  emit: jest.fn().mockResolvedValue({ id: 'evt-1' }),
  on: jest.fn(),
};

describe('NotificationController', () => {
  let controller: NotificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
        { provide: NotificationService, useValue: notificationService },
        { provide: DomainEventBus, useValue: eventBus },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSettings', () => {
    it('returns settings for an active user and restores a soft-deleted row', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.notificationSetting.upsert.mockResolvedValue({
        userId: 'user-1',
        emailEnabled: true,
      });

      await controller.getSettings('user-1');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null },
        select: { id: true },
      });
      expect(prisma.notificationSetting.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { deletedAt: null },
        create: { userId: 'user-1' },
      });
    });

    it('rejects soft-deleted or unknown users with 404', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(controller.getSettings('user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.notificationSetting.upsert).not.toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('updates settings for an active user, clearing any soft-delete marker', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.notificationSetting.upsert.mockResolvedValue({
        userId: 'user-1',
        emailEnabled: false,
      });

      await controller.updateSettings('user-1', { emailEnabled: false });

      expect(prisma.notificationSetting.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { emailEnabled: false, deletedAt: null },
        create: { userId: 'user-1', emailEnabled: false },
      });
    });

    it('rejects soft-deleted or unknown users with 404', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        controller.updateSettings('user-1', { emailEnabled: false }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.notificationSetting.upsert).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToPush', () => {
    const subscription = {
      endpoint: 'https://push.example.com/sub',
      keys: {
        p256dh: Buffer.from('p256dh-key').toString('base64'),
        auth: Buffer.from('auth-key').toString('base64'),
      },
    };

    it('stores the encrypted subscription for an active user', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      await expect(
        controller.subscribeToPush('user-1', subscription),
      ).resolves.toEqual({ success: true });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          pushSubscription: `encrypted:${JSON.stringify(subscription)}`,
        },
      });
    });

    it('rejects soft-deleted or unknown users with 404', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        controller.subscribeToPush('user-1', subscription),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
