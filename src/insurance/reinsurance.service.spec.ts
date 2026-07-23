import { ReinsuranceService } from './reinsurance.service';
import { PrismaService } from '../prisma.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface MockPrismaService {
  $transaction: jest.Mock;
  reinsuranceContract: {
    create: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
  };
}

describe('ReinsuranceService', () => {
  let service: ReinsuranceService;
  let prisma: MockPrismaService;
  let eventBus: { emit: jest.Mock; on: jest.Mock };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      reinsuranceContract: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    eventBus = {
      emit: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      on: jest.fn(),
    };

    service = new ReinsuranceService(
      prisma as unknown as PrismaService,
      eventBus as unknown as DomainEventBus,
    );
    jest.clearAllMocks();
  });

  describe('createContract', () => {
    it('should create and save a reinsurance contract and emit REINSURANCE_CONTRACT_CREATED event', async () => {
      const contractData = {
        poolId: 'pool-1',
        coverageLimit: 50000,
        premiumRate: 0.02,
      };

      const createdContract = {
        id: 'contract-1',
        ...contractData,
        createdAt: new Date(),
      };

      const mockTx = {
        reinsuranceContract: {
          create: jest.fn().mockResolvedValue(createdContract),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await service.createContract(
        'pool-1',
        new Prisma.Decimal(50000),
        new Prisma.Decimal(0.02),
      );

      expect(mockTx.reinsuranceContract.create).toHaveBeenCalledWith({
        data: {
          poolId: 'pool-1',
          coverageLimit: new Prisma.Decimal(50000),
          premiumRate: new Prisma.Decimal(0.02),
        },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.REINSURANCE_CONTRACT_CREATED,
        expect.objectContaining({ contractId: 'contract-1' }),
      );
      expect(result).toEqual(createdContract);
    });
  });

  describe('releaseContract', () => {
    it('should throw BadRequestException if contract not found', async () => {
      const mockTx = {
        reinsuranceContract: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(null),
          delete: jest.fn(),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await expect(service.releaseContract('missing')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete the reinsurance contract and emit REINSURANCE_CONTRACT_RELEASED event', async () => {
      const contract = {
        id: 'contract-1',
        poolId: 'pool-1',
        coverageLimit: 50000,
        premiumRate: 0.02,
        createdAt: new Date(),
      };

      const mockTx = {
        reinsuranceContract: {
          create: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(contract),
          delete: jest.fn().mockResolvedValue(contract),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await service.releaseContract('contract-1');

      expect(mockTx.reinsuranceContract.delete).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.REINSURANCE_CONTRACT_RELEASED,
        expect.objectContaining({ contractId: 'contract-1' }),
      );
      expect(result).toEqual(contract);
    });
  });
});
