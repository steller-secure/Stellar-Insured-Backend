import { InsuranceService } from './insurance.service';
import { PricingService } from './pricing.service';
import { PoolService } from './pool.service';
import { RiskType } from './enums/risk-type.enum';
import { PolicyStatus } from './enums/policy-status.enum';
import { BadRequestException } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { InsurancePolicyRepository } from '../common/repositories/insurance-policy.repository';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

interface MockPrismaService {
  $transaction: jest.Mock;
}

interface MockPolicyRepository {
  findById: jest.Mock;
  createPolicy: jest.Mock;
  updateStatus: jest.Mock;
}

describe('InsuranceService', () => {
  let service: InsuranceService;
  let pricing: PricingService;
  let pools: PoolService;
  let prisma: MockPrismaService;
  let auditService: Pick<AuditService, 'logPurchase' | 'logUpdate'>;
  let policyRepository: MockPolicyRepository;

  beforeEach(() => {
    pricing = { calculatePremium: jest.fn() } as unknown as PricingService;
    pools = { lockCapital: jest.fn(), unlockCapital: jest.fn() } as unknown as PoolService;

    prisma = {
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn()),
    };

    auditService = {
      logPurchase: jest.fn(),
      logUpdate: jest.fn(),
    };

    policyRepository = {
      findById: jest.fn(),
      createPolicy: jest.fn(),
      updateStatus: jest.fn(),
    };

    service = new InsuranceService(
      pricing,
      pools,
      prisma as unknown as PrismaService,
      auditService as AuditService,
      policyRepository as unknown as InsurancePolicyRepository,
    );
    jest.clearAllMocks();
  });

  describe('purchasePolicy', () => {
    it('should throw BadRequestException if userId is missing', async () => {
      await expect(
        service.purchasePolicy('', 'pool-1', RiskType.PROJECT_FAILURE, new Prisma.Decimal(1000)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if poolId is missing', async () => {
      await expect(
        service.purchasePolicy('user-1', '', RiskType.PROJECT_FAILURE, new Prisma.Decimal(1000)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if coverageAmount is not positive', async () => {
      await expect(
        service.purchasePolicy('user-1', 'pool-1', RiskType.PROJECT_FAILURE, new Prisma.Decimal(0)),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.purchasePolicy('user-1', 'pool-1', RiskType.PROJECT_FAILURE, new Prisma.Decimal(-100)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully purchase a policy', async () => {
      const createdPolicy = { id: 'policy-1', userId: 'user-1', poolId: 'pool-1' };
      (pricing.calculatePremium as jest.Mock).mockReturnValue(new Prisma.Decimal(500));
      (pools.lockCapital as jest.Mock).mockResolvedValue(undefined);
      policyRepository.createPolicy.mockResolvedValue(createdPolicy);
      prisma.$transaction.mockImplementation(async (fn: any) => fn());

      const result = await service.purchasePolicy(
        'user-1',
        'pool-1',
        RiskType.PROJECT_FAILURE,
        new Prisma.Decimal(10000),
      );

      expect(pricing.calculatePremium).toHaveBeenCalledWith(
        RiskType.PROJECT_FAILURE,
        new Prisma.Decimal(10000),
      );
      expect(pools.lockCapital).toHaveBeenCalled();
      expect(policyRepository.createPolicy).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          poolId: 'pool-1',
          riskType: RiskType.PROJECT_FAILURE,
          coverageAmount: new Prisma.Decimal(10000),
          premium: new Prisma.Decimal(500),
        },
        undefined,
      );
      expect(result.id).toBe('policy-1');
    });

    it('should rollback transaction on lockCapital error', async () => {
      (pricing.calculatePremium as jest.Mock).mockReturnValue(new Prisma.Decimal(500));
      (pools.lockCapital as jest.Mock).mockRejectedValue(new Error('Pool capital insufficient'));
      prisma.$transaction.mockImplementation(async (fn: any) => fn());

      await expect(
        service.purchasePolicy('user-1', 'pool-1', RiskType.PROJECT_FAILURE, new Prisma.Decimal(10000)),
      ).rejects.toThrow('Pool capital insufficient');
    });

    it('writes plain, unencrypted decimal values for coverageAmount and premium', async () => {
      (pricing.calculatePremium as jest.Mock).mockReturnValue(new Prisma.Decimal(500));
      (pools.lockCapital as jest.Mock).mockResolvedValue(undefined);
      policyRepository.createPolicy.mockResolvedValue({ id: 'policy-1' });
      prisma.$transaction.mockImplementation(async (fn: any) => fn());

      await service.purchasePolicy('user-1', 'pool-1', RiskType.PROJECT_FAILURE, new Prisma.Decimal(10000));

      expect(policyRepository.createPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          coverageAmount: new Prisma.Decimal(10000),
          premium: new Prisma.Decimal(500),
        }),
        undefined,
      );
    });

    it('does not depend on EncryptionService for numeric fields', () => {
      expect((service as any)['encryption']).toBeUndefined();
    });
  });

  describe('cancelPolicy', () => {
    it('should throw BadRequestException if policy not found', async () => {
      policyRepository.findById.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: any) => fn());

      await expect(service.cancelPolicy('missing')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if policy already cancelled', async () => {
      policyRepository.findById.mockResolvedValue({
        id: 'policy-1',
        status: PolicyStatus.CANCELLED,
        poolId: 'pool-1',
        coverageAmount: new Prisma.Decimal(10000),
      });
      prisma.$transaction.mockImplementation(async (fn: any) => fn());

      await expect(service.cancelPolicy('policy-1')).rejects.toThrow(BadRequestException);
    });

    it('should cancel policy and unlock capital', async () => {
      const policy = {
        id: 'policy-1',
        status: PolicyStatus.ACTIVE,
        poolId: 'pool-1',
        coverageAmount: new Prisma.Decimal(10000),
      };
      const cancelled = { ...policy, status: PolicyStatus.CANCELLED };

      policyRepository.findById.mockResolvedValue(policy);
      policyRepository.updateStatus.mockResolvedValue(cancelled);
      (pools.unlockCapital as jest.Mock).mockResolvedValue(undefined);
      prisma.$transaction.mockImplementation(async (fn: any) => fn());

      const result = await service.cancelPolicy('policy-1');

      expect(result.status).toBe(PolicyStatus.CANCELLED);
      expect(pools.unlockCapital).toHaveBeenCalledWith(
        'pool-1',
        new Prisma.Decimal(10000),
        undefined,
      );
    });
  });

  describe('expirePolicy', () => {
    it('should throw BadRequestException if policy not found', async () => {
      policyRepository.findById.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: any) => fn());

      await expect(service.expirePolicy('missing')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if policy already expired', async () => {
      policyRepository.findById.mockResolvedValue({
        id: 'policy-1',
        status: PolicyStatus.EXPIRED,
        poolId: 'pool-1',
        coverageAmount: new Prisma.Decimal(10000),
      });
      prisma.$transaction.mockImplementation(async (fn: any) => fn());

      await expect(service.expirePolicy('policy-1')).rejects.toThrow(BadRequestException);
    });

    it('should expire policy and unlock capital', async () => {
      const policy = {
        id: 'policy-1',
        status: PolicyStatus.ACTIVE,
        poolId: 'pool-1',
        coverageAmount: new Prisma.Decimal(10000),
      };
      const expired = { ...policy, status: PolicyStatus.EXPIRED };

      policyRepository.findById.mockResolvedValue(policy);
      policyRepository.updateStatus.mockResolvedValue(expired);
      (pools.unlockCapital as jest.Mock).mockResolvedValue(undefined);
      prisma.$transaction.mockImplementation(async (fn: any) => fn());

      const result = await service.expirePolicy('policy-1');

      expect(result.status).toBe(PolicyStatus.EXPIRED);
      expect(pools.unlockCapital).toHaveBeenCalledWith(
        'pool-1',
        new Prisma.Decimal(10000),
        undefined,
      );
    });
  });
});
