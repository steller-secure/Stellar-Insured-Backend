import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';

interface MockPrismaService {
  user: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  notification: {
    updateMany: jest.Mock;
  };
  notificationSetting: {
    updateMany: jest.Mock;
  };
  insurancePolicy: {
    updateMany: jest.Mock;
  };
  claim: {
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

const prisma: MockPrismaService = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  notification: {
    updateMany: jest.fn(),
  },
  notificationSetting: {
    updateMany: jest.fn(),
  },
  insurancePolicy: {
    updateMany: jest.fn(),
  },
  claim: {
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const buildMockTx = (userResult: any) => ({
  user: {
    create: jest.fn().mockResolvedValue(userResult),
    update: jest.fn().mockResolvedValue(userResult),
  },
});

const encryption = {
  encrypt: jest.fn((value: string) => `encrypted:${value}`),
  decrypt: jest.fn((value: string) => value.replace('encrypted:', '')),
};

const eventBus = {
  emit: jest.fn().mockResolvedValue({ id: 'evt-1' }),
  on: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      deletedAt: new Date(),
    });
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    prisma.notificationSetting.updateMany.mockResolvedValue({ count: 1 });
    prisma.insurancePolicy.updateMany.mockResolvedValue({ count: 1 });
    prisma.claim.updateMany.mockResolvedValue({ count: 1 });

    prisma.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') {
        return arg(buildMockTx({ id: 'user-1' }));
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    });

    service = new UserService(
      prisma as unknown as PrismaService,
      encryption as unknown as EncryptionService,
      eventBus as unknown as DomainEventBus,
    );
    jest.clearAllMocks();
  });

  it('rejects invalid user ID format in findById', async () => {
    await expect(service.findById('<script>alert(1)</script>')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.findById('DROP TABLE users;')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('filters soft-deleted users from id lookups', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.findById('clabcdefghij')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'clabcdefghij',
        deletedAt: null,
      },
    });
  });

  it('rejects invalid wallet address format in findByWallet', async () => {
    await expect(
      service.findByWallet('<script>evil()</script>'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.findByWallet("'; DROP TABLE users;--"),
    ).rejects.toThrow(BadRequestException);
  });

  it('filters soft-deleted users from wallet lookups', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.findByWallet('GABC123')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        walletAddress: 'GABC123',
        deletedAt: null,
      },
    });
  });

  it('excludes soft-deleted users from pagination and totals', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        walletAddress: 'encrypted:GABC123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.findPaginated(2, 10);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      skip: 10,
      take: 10,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('marks a user as deleted instead of hard deleting the record', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'clabcdefghij',
      walletAddress: 'encrypted:GABC123',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.delete('clabcdefghij');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'clabcdefghij' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.notificationSetting.updateMany).toHaveBeenCalledWith({
      where: { userId: 'clabcdefghij' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.insurancePolicy.updateMany).toHaveBeenCalledWith({
      where: { userId: 'clabcdefghij' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.claim.updateMany).toHaveBeenCalledWith({
      where: { policy: { userId: 'clabcdefghij' } },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('refuses to delete a user that is missing or already soft-deleted', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.delete('clabcdefghij')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects invalid wallet address format in create', async () => {
    await expect(service.create('<script>evil()</script>')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('prevents duplicate active wallet addresses during create', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(service.create('GABC123')).rejects.toThrow(ConflictException);
  });

  it('creates a user with encrypted email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const createdUser = {
      id: 'user-new',
      walletAddress: 'GABC123',
      email: 'encrypted:person@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockTx = buildMockTx(createdUser);
    prisma.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return arg;
    });

    const result = await service.create('GABC123', ' person@example.com ');

    expect(mockTx.user.create).toHaveBeenCalledWith({
      data: {
        walletAddress: 'GABC123',
        email: 'encrypted:person@example.com',
        reputationScore: 50,
        notificationSettings: { create: {} },
      },
      include: { notificationSettings: true },
    });
    expect(result).toEqual(createdUser);
  });

  it('sanitizes update payloads into explicit Prisma user update data', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'clabcdefghij',
      walletAddress: 'GABC123',
      email: null,
      pushSubscription: null,
      profileData: null,
      reputationScore: 0,
      trustScore: 500,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const updatedUser = {
      id: 'clabcdefghij',
      walletAddress: 'GABC123',
      email: 'encrypted:person@example.com',
      pushSubscription: 'encrypted:subscription',
      profileData: { displayName: 'Ada' },
      reputationScore: 0,
      trustScore: 500,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const mockTx = buildMockTx(updatedUser);
    prisma.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return arg;
    });

    await service.update('clabcdefghij', {
      email: ' person@example.com ',
      profileData: {
        displayName: '<b>Ada</b>',
      },
      pushSubscription: ' subscription ',
    });

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'clabcdefghij' },
      data: {
        email: 'encrypted:person@example.com',
        profileData: { displayName: 'Ada' },
        pushSubscription: 'encrypted:subscription',
      },
    });
  });
});
