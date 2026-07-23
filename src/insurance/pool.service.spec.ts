import { PoolService } from './pool.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';
import { Prisma } from '@prisma/client';

interface MockPrismaService {
  insurancePool: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
}

describe('PoolService', () => {
  let service: PoolService;
  let prisma: MockPrismaService;
  let eventBus: { emit: jest.Mock; on: jest.Mock };

  const mockPool = {
    id: 'pool-1',
    name: 'Test Pool',
    capital: 10000,
    lockedCapital: 2000,
    createdAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      insurancePool: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = {
      emit: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      on: jest.fn(),
    };

    service = new PoolService(
      prisma as unknown as PrismaService,
      eventBus as unknown as DomainEventBus,
    );
    jest.clearAllMocks();
  });

  describe('addCapital', () => {
    it('should throw BadRequestException if amount is not positive', async () => {
      await expect(
        service.addCapital('pool-1', new Prisma.Decimal(0)),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.addCapital('pool-1', new Prisma.Decimal(-100)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if pool is not found', async () => {
      prisma.insurancePool.findUnique.mockResolvedValue(null);

      await expect(
        service.addCapital('nonexistent', new Prisma.Decimal(500)),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.insurancePool.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
      });
    });

    it('should add capital to an existing pool and emit POOL_CAPITAL_ADDED event', async () => {
      const pool = { ...mockPool };
      const updatedPool = { ...pool, capital: 15000 };
      prisma.insurancePool.findUnique.mockResolvedValue(pool);
      prisma.insurancePool.update.mockResolvedValue(updatedPool);

      const result = await service.addCapital(
        'pool-1',
        new Prisma.Decimal(5000),
      );

      expect(prisma.insurancePool.update).toHaveBeenCalledWith({
        where: { id: 'pool-1' },
        data: { capital: { increment: new Prisma.Decimal(5000) } },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.POOL_CAPITAL_ADDED,
        expect.objectContaining({ poolId: 'pool-1' }),
      );
      expect(result.capital).toBe(15000);
    });
  });

  describe('lockCapital', () => {
    it('should throw BadRequestException if amount is not positive', async () => {
      await expect(
        service.lockCapital('pool-1', new Prisma.Decimal(0)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should lock capital and emit POOL_CAPITAL_LOCKED event', async () => {
      const pool = { ...mockPool };
      const updatedPool = { ...pool, lockedCapital: 3000 };
      prisma.insurancePool.findUnique.mockResolvedValue(pool);
      prisma.insurancePool.update.mockResolvedValue(updatedPool);

      const result = await service.lockCapital(
        'pool-1',
        new Prisma.Decimal(1000),
      );

      expect(prisma.insurancePool.update).toHaveBeenCalledWith({
        where: { id: 'pool-1' },
        data: { lockedCapital: { increment: new Prisma.Decimal(1000) } },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.POOL_CAPITAL_LOCKED,
        expect.objectContaining({ poolId: 'pool-1' }),
      );
      expect(result.lockedCapital).toBe(3000);
    });
  });

  describe('unlockCapital', () => {
    it('should unlock capital and emit POOL_CAPITAL_UNLOCKED event', async () => {
      const pool = { ...mockPool };
      const updatedPool = { ...pool, lockedCapital: 1000 };
      prisma.insurancePool.findUnique.mockResolvedValue(pool);
      prisma.insurancePool.update.mockResolvedValue(updatedPool);

      const result = await service.unlockCapital(
        'pool-1',
        new Prisma.Decimal(1000),
      );

      expect(prisma.insurancePool.update).toHaveBeenCalledWith({
        where: { id: 'pool-1' },
        data: { lockedCapital: { decrement: new Prisma.Decimal(1000) } },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.POOL_CAPITAL_UNLOCKED,
        expect.objectContaining({ poolId: 'pool-1' }),
      );
      expect(result.lockedCapital).toBe(1000);
    });

    it('should enforce availableCapital invariant', async () => {
      const pool = { ...mockPool, capital: 500, lockedCapital: 2000 };
      prisma.insurancePool.findUnique.mockResolvedValue(pool);
      prisma.insurancePool.update.mockResolvedValue({
        ...pool,
        lockedCapital: 1000,
      });

      await expect(
        service.unlockCapital('pool-1', new Prisma.Decimal(1000)),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
