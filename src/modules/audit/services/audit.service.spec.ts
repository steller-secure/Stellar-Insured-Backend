import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from '../entities/audit.entity';
import { AuditActionType } from '../enums/audit-action-type.enum';

describe('AuditService', () => {
  let service: AuditService;
  let auditLogRepository: Repository<AuditLog>;

  const mockAuditLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditLogRepository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logAction', () => {
    it('should create and save an audit log successfully', async () => {
      const actionType = AuditActionType.CLAIM_SUBMITTED;
      const actor = 'user123';
      const entityReference = 'claim456';
      const metadata = { amount: 1000 };

      const mockAuditLog = {
        id: 'audit123',
        actionType,
        actor,
        entityReference,
        metadata,
        timestamp: new Date(),
      };

      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      await service.logAction(actionType, actor, entityReference, metadata);

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith({
        actionType,
        actor,
        entityReference,
        metadata,
      });
      expect(mockAuditLogRepository.save).toHaveBeenCalledWith(mockAuditLog);
    });

    it('should handle null entityReference', async () => {
      const actionType = AuditActionType.POLICY_CREATED;
      const actor = 'user123';

      const mockAuditLog = {
        id: 'audit123',
        actionType,
        actor,
        entityReference: undefined,
        metadata: undefined,
        timestamp: new Date(),
      };

      mockAuditLogRepository.create.mockReturnValue(mockAuditLog);
      mockAuditLogRepository.save.mockResolvedValue(mockAuditLog);

      await service.logAction(actionType, actor);

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith({
        actionType,
        actor,
        entityReference: undefined,
        metadata: undefined,
      });
    });

    it('should validate actionType', async () => {
      const invalidActionType = 'INVALID_ACTION' as any;
      const actor = 'user123';

      await expect(service.logAction(invalidActionType, actor)).rejects.toThrow(
        'Invalid actionType provided',
      );
    });

    it('should validate actor', async () => {
      const actionType = AuditActionType.CLAIM_SUBMITTED;
      const invalidActor = '';

      await expect(service.logAction(actionType, invalidActor)).rejects.toThrow(
        'Invalid actor provided',
      );
    });

    it('should not throw on database errors', async () => {
      const actionType = AuditActionType.CLAIM_SUBMITTED;
      const actor = 'user123';

      mockAuditLogRepository.save.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(service.logAction(actionType, actor)).resolves.not.toThrow();
    });
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getAuditLogs({});

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      });
    });

    it('should apply filters correctly', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockAuditLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const filters = {
        actionType: AuditActionType.CLAIM_SUBMITTED,
        actor: 'user123',
        entityReference: 'claim456',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        page: 2,
        limit: 20,
        sortBy: 'timestamp',
        sortOrder: 'DESC' as const,
      };

      await service.getAuditLogs(filters);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.actionType = :actionType', {
        actionType: AuditActionType.CLAIM_SUBMITTED,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.actor = :actor', {
        actor: 'user123',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit.entityReference = :entityReference',
        { entityReference: 'claim456' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.timestamp >= :startDate', {
        startDate: filters.startDate,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.timestamp <= :endDate', {
        endDate: filters.endDate,
      });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });
  });
});