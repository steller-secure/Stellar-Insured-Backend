import { ClaimService } from './claim.service';
import { ClaimStatus } from './enums/claim-status.enum';
import { PolicyStatus } from './enums/policy-status.enum';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PoolService } from './pool.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';
import { Prisma } from '@prisma/client';

interface MockTransactionClient {
  claim: {
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
}

interface MockPrismaService {
  claim: {
    findUnique: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
}

interface MockPoolService {
  unlockCapital: jest.Mock;
}

describe('ClaimService', () => {
  let service: ClaimService;
  let prisma: MockPrismaService;
  let pools: MockPoolService;
  let eventBus: { emit: jest.Mock; on: jest.Mock };

  const mockPolicy = {
    id: 'policy-1',
    userId: 'user-1',
    poolId: 'pool-1',
    status: PolicyStatus.ACTIVE,
    coverageAmount: new Prisma.Decimal(100000),
    premium: new Prisma.Decimal(5000),
    startDate: new Date('2025-01-01'),
    endDate: new Date('2027-01-01'),
  };

  const mockClaim = {
    id: 'claim-1',
    policyId: 'policy-1',
    claimAmount: new Prisma.Decimal(50000),
    status: ClaimStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    policy: mockPolicy,
  };

  const buildMockTx = (updateResult: any) => ({
    claim: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(updateResult),
      count: jest.fn(),
    },
  });

  beforeEach(() => {
    prisma = {
      claim: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (fn: (tx: any) => Promise<any>) =>
          fn({
            claim: {
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          }),
        ),
    };

    pools = {
      unlockCapital: jest.fn(),
    };

    eventBus = {
      emit: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      on: jest.fn(),
    };

    service = new ClaimService(
      prisma as unknown as PrismaService,
      pools as unknown as PoolService,
      eventBus as unknown as DomainEventBus,
    );
    jest.clearAllMocks();
  });

  describe('createClaim', () => {
    it('should create a claim and emit CLAIM_CREATED event', async () => {
      const createdClaim = {
        id: 'claim-new',
        policyId: 'policy-1',
        claimAmount: 50000,
        status: ClaimStatus.PENDING,
      };
      prisma.claim.create.mockResolvedValue(createdClaim);

      const result = await service.createClaim(
        'policy-1',
        new Prisma.Decimal(50000),
      );

      expect(prisma.claim.create).toHaveBeenCalledWith({
        data: {
          policyId: 'policy-1',
          claimAmount: new Prisma.Decimal(50000),
          status: ClaimStatus.PENDING,
        },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.CLAIM_CREATED,
        expect.objectContaining({ entityId: 'claim-new' }),
      );
      expect(result.claimAmount).toBe(50000);
    });
  });

  describe('assessClaim', () => {
    it('should throw NotFoundException if claim does not exist', async () => {
      prisma.claim.findUnique.mockResolvedValue(null);

      await expect(service.assessClaim('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if policy is not found on claim', async () => {
      prisma.claim.findUnique.mockResolvedValue({ ...mockClaim, policy: null });

      await expect(service.assessClaim('claim-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject claim if policy is not active', async () => {
      const inactivePolicy = { ...mockPolicy, status: PolicyStatus.EXPIRED };
      const claimWithInactivePolicy = { ...mockClaim, policy: inactivePolicy };

      prisma.claim.findUnique.mockResolvedValue(claimWithInactivePolicy);
      prisma.claim.count.mockResolvedValue(0);

      const mockTx = buildMockTx({
        ...mockClaim,
        status: ClaimStatus.REJECTED,
        policy: inactivePolicy,
      });
      mockTx.claim.findUnique.mockResolvedValue(claimWithInactivePolicy);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      (pools.unlockCapital as jest.Mock).mockResolvedValue(undefined);

      await expect(service.assessClaim('claim-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.CLAIM_REJECTED,
        expect.objectContaining({ claimId: 'claim-1' }),
      );
    });

    it('should reject claim if claim amount exceeds coverage', async () => {
      const claim = { ...mockClaim, claimAmount: new Prisma.Decimal(200000) };

      prisma.claim.findUnique.mockResolvedValue(claim);
      prisma.claim.count.mockResolvedValue(0);

      const mockTx = buildMockTx({
        ...claim,
        status: ClaimStatus.REJECTED,
      });
      mockTx.claim.findUnique.mockResolvedValue(claim);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      (pools.unlockCapital as jest.Mock).mockResolvedValue(undefined);

      await expect(service.assessClaim('claim-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.CLAIM_REJECTED,
        expect.objectContaining({ claimId: 'claim-1' }),
      );
    });

    it('should approve claim when all checks pass and emit CLAIM_APPROVED event', async () => {
      const claim = { ...mockClaim, claimAmount: new Prisma.Decimal(50000) };
      const approvedClaim = {
        ...claim,
        status: ClaimStatus.APPROVED,
        payoutAmount: new Prisma.Decimal(50000),
      };

      prisma.claim.findUnique
        .mockResolvedValueOnce(claim)
        .mockResolvedValueOnce(claim);

      prisma.claim.count.mockResolvedValue(0);

      const mockTx = buildMockTx(approvedClaim);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await service.assessClaim('claim-1');

      expect(result.status).toBe(ClaimStatus.APPROVED);
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.CLAIM_APPROVED,
        expect.objectContaining({ claimId: 'claim-1' }),
      );
    });

    it('should detect fraud with 2+ indicators and emit CLAIM_FRAUD_DETECTED event', async () => {
      const claim = {
        ...mockClaim,
        claimAmount: new Prisma.Decimal(50000),
        createdAt: new Date('2026-04-27T03:00:00Z'),
      };
      const approvedClaim = {
        ...claim,
        status: ClaimStatus.APPROVED,
        payoutAmount: new Prisma.Decimal(50000),
      };

      prisma.claim.findUnique
        .mockResolvedValueOnce(claim)
        .mockResolvedValueOnce(claim);

      prisma.claim.count.mockResolvedValueOnce(1).mockResolvedValueOnce(4);

      const mockTx = buildMockTx(approvedClaim);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.assessClaim('claim-1');

      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.CLAIM_FRAUD_DETECTED,
        expect.objectContaining({
          claimId: 'claim-1',
          reason: 'High fraud risk score detected',
        }),
      );
    });
  });

  describe('payClaim', () => {
    it('should throw NotFoundException if claim does not exist', async () => {
      const mockTx: MockTransactionClient = {
        claim: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
          count: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await expect(service.payClaim('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update claim status to PAID and emit CLAIM_PAID event', async () => {
      const claim = { ...mockClaim };
      const paidClaim = { ...claim, status: ClaimStatus.PAID };

      const mockTx: MockTransactionClient = {
        claim: {
          findUnique: jest.fn().mockResolvedValue(claim),
          update: jest.fn().mockResolvedValue(paidClaim),
          count: jest.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
      (pools.unlockCapital as jest.Mock).mockResolvedValue(undefined);

      const result = await service.payClaim('claim-1');

      expect(result.status).toBe(ClaimStatus.PAID);
      expect(pools.unlockCapital).toHaveBeenCalledWith(
        'pool-1',
        new Prisma.Decimal(50000),
        expect.anything(),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        DomainEventName.CLAIM_PAID,
        expect.objectContaining({ claimId: 'claim-1' }),
      );
    });
  });
});
