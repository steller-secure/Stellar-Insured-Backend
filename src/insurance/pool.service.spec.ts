import { PoolService } from './pool.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { InsurancePoolRepository } from '../common/repositories/insurance-pool.repository';
import { Prisma } from '@prisma/client';

interface MockInsurancePoolRepository {
  findByIdRequired: jest.Mock;
  incrementCapital: jest.Mock;
  incrementLockedCapital: jest.Mock;
  decrementLockedCapital: jest.Mock;
}

interface MockAuditService {
  logAddCapital: jest.Mock;
  logUpdate: jest.Mock;
  logUnlockCapital: jest.Mock;
}

describe('PoolService', () => {
  let service: PoolService;
  let poolRepository: MockInsurancePoolRepository;
  let auditService: MockAuditService;

  const mockPool = {
    id: 'pool-1',
    name: 'Test Pool',
    capital: new Prisma.Decimal(10000),
    lockedCapital: new Prisma.Decimal(2000),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    poolRepository = {
      findByIdRequired: jest.fn(),
      incrementCapital: jest.fn(),
      incrementLockedCapital: jest.fn(),
      decrementLockedCapital: jest.fn(),
    };

    auditService = {
      logAddCapital: jest.fn(),
      logUpdate: jest.fn(),
      logUnlockCapital: jest.fn(),
    };

    service = new PoolService(
      poolRepository as unknown as InsurancePoolRepository,
      auditService as unknown as AuditService,
    );
    jest.clearAllMocks();
  });

  describe('addCapital', () => {
    it('should throw BadRequestException if amount is not positive', async () => {
      await expect(service.addCapital('pool-1', new Prisma.Decimal(0))).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addCapital('pool-1', new Prisma.Decimal(-100))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if pool is not found', async () => {
      poolRepository.findByIdRequired.mockResolvedValue(null);

      await expect(service.addCapital('nonexistent', new Prisma.Decimal(500))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should add capital to an existing pool', async () => {
      const updatedPool = { ...mockPool, capital: new Prisma.Decimal(15000) };
      poolRepository.findByIdRequired.mockResolvedValue(mockPool);
      poolRepository.incrementCapital.mockResolvedValue(updatedPool);

      const result = await service.addCapital('pool-1', new Prisma.Decimal(5000));

      expect(poolRepository.incrementCapital).toHaveBeenCalledWith(
        'pool-1',
        new Prisma.Decimal(5000),
        undefined,
      );
      expect(result.capital).toEqual(new Prisma.Decimal(15000));
    });

    it('should call auditService.logAddCapital after adding capital', async () => {
      const updatedPool = { ...mockPool, capital: new Prisma.Decimal(15000) };
      poolRepository.findByIdRequired.mockResolvedValue(mockPool);
      poolRepository.incrementCapital.mockResolvedValue(updatedPool);

      await service.addCapital('pool-1', new Prisma.Decimal(5000));

      expect(auditService.logAddCapital).toHaveBeenCalledWith(
        'InsurancePool',
        'pool-1',
        expect.any(Object),
        expect.any(Object),
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('lockCapital', () => {
    it('should throw BadRequestException if amount is not positive', async () => {
      await expect(service.lockCapital('pool-1', new Prisma.Decimal(0))).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.lockCapital('pool-1', new Prisma.Decimal(-50))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if pool is not found', async () => {
      poolRepository.findByIdRequired.mockResolvedValue(null);

      await expect(service.lockCapital('nonexistent', new Prisma.Decimal(1000))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should lock capital on an existing pool', async () => {
      const updatedPool = { ...mockPool, lockedCapital: new Prisma.Decimal(3000) };
      poolRepository.findByIdRequired.mockResolvedValue(mockPool);
      poolRepository.incrementLockedCapital.mockResolvedValue(updatedPool);

      const result = await service.lockCapital('pool-1', new Prisma.Decimal(1000));

      expect(poolRepository.incrementLockedCapital).toHaveBeenCalledWith(
        'pool-1',
        new Prisma.Decimal(1000),
        undefined,
      );
      expect(result.lockedCapital).toEqual(new Prisma.Decimal(3000));
    });

    it('should pass the transaction client through to the repository', async () => {
      const updatedPool = { ...mockPool, lockedCapital: new Prisma.Decimal(5000) };
      poolRepository.findByIdRequired.mockResolvedValue(mockPool);
      poolRepository.incrementLockedCapital.mockResolvedValue(updatedPool);

      const mockTx = {} as any;
      await service.lockCapital('pool-1', new Prisma.Decimal(3000), mockTx);

      expect(poolRepository.findByIdRequired).toHaveBeenCalledWith('pool-1', mockTx);
      expect(poolRepository.incrementLockedCapital).toHaveBeenCalledWith(
        'pool-1',
        new Prisma.Decimal(3000),
        mockTx,
      );
    });
  });

  describe('unlockCapital', () => {
    it('should throw BadRequestException if amount is not positive', async () => {
      await expect(service.unlockCapital('pool-1', new Prisma.Decimal(0))).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.unlockCapital('pool-1', new Prisma.Decimal(-50))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if pool is not found', async () => {
      poolRepository.findByIdRequired.mockResolvedValue(null);

      await expect(service.unlockCapital('nonexistent', new Prisma.Decimal(1000))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should unlock capital on an existing pool', async () => {
      const updatedPool = { ...mockPool, lockedCapital: new Prisma.Decimal(1000) };
      poolRepository.findByIdRequired.mockResolvedValue(mockPool);
      poolRepository.decrementLockedCapital.mockResolvedValue(updatedPool);

      const result = await service.unlockCapital('pool-1', new Prisma.Decimal(1000));

      expect(poolRepository.decrementLockedCapital).toHaveBeenCalledWith(
        'pool-1',
        new Prisma.Decimal(1000),
        undefined,
      );
      expect(result.lockedCapital).toEqual(new Prisma.Decimal(1000));
    });

    it('should enforce availableCapital invariant', async () => {
      // capital=500, lockedCapital=1000 → available = -500 → violation
      const updatedPool = {
        ...mockPool,
        capital: new Prisma.Decimal(500),
        lockedCapital: new Prisma.Decimal(1000),
      };
      poolRepository.findByIdRequired.mockResolvedValue(mockPool);
      poolRepository.decrementLockedCapital.mockResolvedValue(updatedPool);

      await expect(service.unlockCapital('pool-1', new Prisma.Decimal(1000))).rejects.toThrow(
        BadRequestException,
      );
      expect(auditService.logUnlockCapital).not.toHaveBeenCalled();
    });

    it('should call auditService.logUnlockCapital after unlocking', async () => {
      const updatedPool = { ...mockPool, lockedCapital: new Prisma.Decimal(1000) };
      poolRepository.findByIdRequired.mockResolvedValue(mockPool);
      poolRepository.decrementLockedCapital.mockResolvedValue(updatedPool);

      await service.unlockCapital('pool-1', new Prisma.Decimal(1000));

      expect(auditService.logUnlockCapital).toHaveBeenCalledWith(
        'InsurancePool',
        'pool-1',
        expect.any(Object),
        expect.any(Object),
        undefined,
        undefined,
        undefined,
      );
    });
  });
});
