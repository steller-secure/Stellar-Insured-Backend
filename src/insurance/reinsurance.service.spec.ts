import { ReinsuranceService } from './reinsurance.service';
import { AuditService } from './services/audit.service';
import { ReinsuranceContractRepository } from '../common/repositories/reinsurance-contract.repository';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

interface MockReinsuranceContractRepository {
  createContract: jest.Mock;
  findByIdStrict: jest.Mock;
  deleteContract: jest.Mock;
}

interface MockAuditService {
  logCreate: jest.Mock;
  logDelete: jest.Mock;
}

interface MockPrismaService {
  $transaction: jest.Mock;
}

describe('ReinsuranceService', () => {
  let service: ReinsuranceService;
  let reinsuranceRepository: MockReinsuranceContractRepository;
  let auditService: MockAuditService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    reinsuranceRepository = {
      createContract: jest.fn(),
      findByIdStrict: jest.fn(),
      deleteContract: jest.fn(),
    };

    auditService = {
      logCreate: jest.fn(),
      logDelete: jest.fn(),
    };

    prisma = {
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn()),
    };

    service = new ReinsuranceService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      reinsuranceRepository as unknown as ReinsuranceContractRepository,
    );
    jest.clearAllMocks();
  });

  describe('createContract', () => {
    it('should create and return a reinsurance contract', async () => {
      const createdContract = {
        id: 'contract-1',
        poolId: 'pool-1',
        coverageLimit: new Prisma.Decimal(50000),
        premiumRate: new Prisma.Decimal(0.02),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      prisma.$transaction.mockImplementation(async (fn: any) => fn());
      reinsuranceRepository.createContract.mockResolvedValue(createdContract);

      const result = await service.createContract(
        'pool-1',
        new Prisma.Decimal(50000),
        new Prisma.Decimal(0.02),
      );

      expect(reinsuranceRepository.createContract).toHaveBeenCalledWith(
        {
          poolId: 'pool-1',
          coverageLimit: new Prisma.Decimal(50000),
          premiumRate: new Prisma.Decimal(0.02),
        },
        undefined,
      );
      expect(result).toEqual(createdContract);
    });

    it('should call auditService.logCreate after creating', async () => {
      const createdContract = {
        id: 'contract-1',
        poolId: 'pool-1',
        coverageLimit: new Prisma.Decimal(100000),
        premiumRate: new Prisma.Decimal(0.05),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      prisma.$transaction.mockImplementation(async (fn: any) => fn());
      reinsuranceRepository.createContract.mockResolvedValue(createdContract);

      await service.createContract(
        'pool-1',
        new Prisma.Decimal(100000),
        new Prisma.Decimal(0.05),
      );

      expect(auditService.logCreate).toHaveBeenCalledWith(
        'ReinsuranceContract',
        'contract-1',
        createdContract,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('releaseContract', () => {
    it('should throw BadRequestException if contract not found', async () => {
      prisma.$transaction.mockImplementation(async (fn: any) => fn());
      reinsuranceRepository.findByIdStrict.mockResolvedValue(null);

      await expect(service.releaseContract('missing')).rejects.toThrow(BadRequestException);
    });

    it('should delete the contract and call auditService.logDelete', async () => {
      const contract = {
        id: 'contract-1',
        poolId: 'pool-1',
        coverageLimit: new Prisma.Decimal(50000),
        premiumRate: new Prisma.Decimal(0.02),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      prisma.$transaction.mockImplementation(async (fn: any) => fn());
      reinsuranceRepository.findByIdStrict.mockResolvedValue(contract);
      reinsuranceRepository.deleteContract.mockResolvedValue(contract);

      const result = await service.releaseContract('contract-1');

      expect(reinsuranceRepository.deleteContract).toHaveBeenCalledWith('contract-1', undefined);
      expect(result).toEqual(contract);
      expect(auditService.logDelete).toHaveBeenCalledWith(
        'ReinsuranceContract',
        'contract-1',
        expect.any(Object),
        undefined,
        'Reinsurance contract released',
        undefined,
      );
    });
  });
});
