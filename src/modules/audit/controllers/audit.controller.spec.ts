import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from '../services/audit.service';
import { AuditActionType } from '../enums/audit-action-type.enum';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: AuditService;

  const mockAuditService = {
    getAuditLogs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    auditService = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with default pagination', async () => {
      const mockResult = {
        data: [
          {
            id: '1',
            actionType: AuditActionType.CLAIM_SUBMITTED,
            actor: 'user123',
            timestamp: new Date(),
            entityReference: 'claim456',
            metadata: { amount: 1000 },
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      mockAuditService.getAuditLogs.mockResolvedValue(mockResult);

      const query = {};
      const result = await controller.getAuditLogs(query);

      expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        sortBy: 'timestamp',
        sortOrder: 'DESC',
      });
      expect(result).toEqual(mockResult);
    });

    it('should apply query filters', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };

      mockAuditService.getAuditLogs.mockResolvedValue(mockResult);

      const query = {
        actionType: AuditActionType.POLICY_CREATED,
        actor: 'user123',
        startDate: '2023-01-01T00:00:00.000Z',
        endDate: '2023-12-31T23:59:59.999Z',
        page: 2,
        limit: 20,
        sortBy: 'actionType',
        sortOrder: 'ASC' as const,
      };

      await controller.getAuditLogs(query);

      expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith({
        actionType: AuditActionType.POLICY_CREATED,
        actor: 'user123',
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        endDate: new Date('2023-12-31T23:59:59.999Z'),
        page: 2,
        limit: 20,
        sortBy: 'actionType',
        sortOrder: 'ASC',
      });
    });
  });
});