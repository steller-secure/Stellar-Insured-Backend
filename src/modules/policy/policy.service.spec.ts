import { Test, TestingModule } from '@nestjs/testing';
import { PolicyService } from './policy.service';
import { PolicyStateMachineService } from './services/policy-state-machine.service';
import { PolicyAuditService } from './services/policy-audit.service';
import { PolicyStatus } from './enums/policy-status.enum';
import { PolicyTransitionAction } from './enums/policy-transition-action.enum';
import { CreatePolicyDto } from './dto/create-policy.dto';

describe('PolicyService - State Transitions', () => {
  let service: PolicyService;
  let stateMachine: PolicyStateMachineService;
  let auditService: PolicyAuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyService, PolicyStateMachineService, PolicyAuditService],
    }).compile();

    service = module.get<PolicyService>(PolicyService);
    stateMachine = module.get<PolicyStateMachineService>(
      PolicyStateMachineService,
    );
    auditService = module.get<PolicyAuditService>(PolicyAuditService);
  });

  describe('createPolicy', () => {
    it('should create policy in DRAFT status', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      expect(policy).toBeDefined();
      expect(policy.status).toBe(PolicyStatus.DRAFT);
      expect(policy.createdBy).toBe('user-123');
      expect(policy.customerId).toBe('cust-123');
    });
  });

  describe('Policy lifecycle transitions', () => {
    it('should execute full lifecycle: DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');
      expect(policy.status).toBe(PolicyStatus.DRAFT);

      // Submit for approval
      const pending = service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
      );
      expect(pending.status).toBe(PolicyStatus.PENDING_APPROVAL);

      // Approve
      const approved = service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.APPROVE,
        'approver-456',
        'approver',
      );
      expect(approved.status).toBe(PolicyStatus.APPROVED);

      // Activate
      const active = service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.ACTIVATE,
        'admin-789',
        'admin',
      );
      expect(active.status).toBe(PolicyStatus.ACTIVE);
    });

    it('should record audit trail for each transition', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
      );

      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.APPROVE,
        'approver-456',
        'approver',
      );

      const auditTrail = service.getAuditTrail(policy.id);

      expect(auditTrail).toHaveLength(2);
      expect(auditTrail[0].fromStatus).toBe(PolicyStatus.DRAFT);
      expect(auditTrail[0].toStatus).toBe(PolicyStatus.PENDING_APPROVAL);
      expect(auditTrail[1].fromStatus).toBe(PolicyStatus.PENDING_APPROVAL);
      expect(auditTrail[1].toStatus).toBe(PolicyStatus.APPROVED);
    });
  });

  describe('Invalid transitions', () => {
    it('should prevent DRAFT -> ACTIVE transition', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      expect(() => {
        service.transitionPolicy(
          policy.id,
          PolicyTransitionAction.ACTIVATE,
          'admin-789',
          'admin',
        );
      }).toThrow();
    });

    it('should prevent ACTIVE -> PENDING_APPROVAL transition', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      // Move to ACTIVE
      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
      );
      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.APPROVE,
        'approver-456',
        'approver',
      );
      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.ACTIVATE,
        'admin-789',
        'admin',
      );

      // Try invalid transition
      expect(() => {
        service.transitionPolicy(
          policy.id,
          PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
          'user-123',
          'creator',
        );
      }).toThrow();
    });
  });

  describe('Permission checks', () => {
    it('should prevent non-admin from activating policy', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
      );
      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.APPROVE,
        'approver-456',
        'approver',
      );

      expect(() => {
        service.transitionPolicy(
          policy.id,
          PolicyTransitionAction.ACTIVATE,
          'user-123',
          'creator', // Not admin or operator
        );
      }).toThrow();
    });

    it('should prevent non-approver from approving', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
      );

      expect(() => {
        service.transitionPolicy(
          policy.id,
          PolicyTransitionAction.APPROVE,
          'user-123',
          'creator', // Not approver
        );
      }).toThrow();
    });
  });

  describe('Reason requirement', () => {
    it('should require reason for cancel action', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      expect(() => {
        service.transitionPolicy(
          policy.id,
          PolicyTransitionAction.CANCEL,
          'admin-789',
          'admin',
        );
      }).toThrow();
    });

    it('should accept cancel action with reason', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      const cancelled = service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.CANCEL,
        'admin-789',
        'admin',
        'Customer request',
      );

      expect(cancelled.status).toBe(PolicyStatus.CANCELLED);
      const auditTrail = service.getAuditTrail(policy.id);
      expect(auditTrail[0].reason).toBe('Customer request');
    });

    it('should require reason for suspend action', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      // Move to ACTIVE
      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
      );
      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.APPROVE,
        'approver-456',
        'approver',
      );
      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.ACTIVATE,
        'admin-789',
        'admin',
      );

      expect(() => {
        service.transitionPolicy(
          policy.id,
          PolicyTransitionAction.SUSPEND,
          'admin-789',
          'admin',
        );
      }).toThrow();
    });
  });

  describe('Audit trail', () => {
    it('should maintain complete audit trail', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
      );

      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.APPROVE,
        'approver-456',
        'approver',
      );

      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.ACTIVATE,
        'admin-789',
        'admin',
      );

      const auditTrail = service.getAuditTrail(policy.id);

      expect(auditTrail).toHaveLength(3);
      expect(auditTrail[0].transitionedBy).toBe('user-123');
      expect(auditTrail[1].transitionedBy).toBe('approver-456');
      expect(auditTrail[2].transitionedBy).toBe('admin-789');
      expect(auditTrail[0].toStatus).toBe(PolicyStatus.PENDING_APPROVAL);
      expect(auditTrail[1].toStatus).toBe(PolicyStatus.APPROVED);
      expect(auditTrail[2].toStatus).toBe(PolicyStatus.ACTIVE);
    });

    it('should include timestamps for each transition', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');
      const beforeTransition = new Date();

      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
      );

      const afterTransition = new Date();
      const auditTrail = service.getAuditTrail(policy.id);

      expect(auditTrail[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeTransition.getTime(),
      );
      expect(auditTrail[0].timestamp.getTime()).toBeLessThanOrEqual(
        afterTransition.getTime(),
      );
    });
  });

  describe('Available transitions', () => {
    it('should return available actions for DRAFT policy', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');
      const actions = service.getAvailableTransitions(policy.id);

      expect(actions).toContain(PolicyTransitionAction.SUBMIT_FOR_APPROVAL);
      expect(actions).toContain(PolicyTransitionAction.CANCEL);
    });

    it('should return available actions for ACTIVE policy', () => {
      const dto: CreatePolicyDto = {
        customerId: 'cust-123',
        coverageType: 'Health',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: 100,
      };

      const policy = service.createPolicy(dto, 'user-123');

      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
      );
      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.APPROVE,
        'approver-456',
        'approver',
      );
      service.transitionPolicy(
        policy.id,
        PolicyTransitionAction.ACTIVATE,
        'admin-789',
        'admin',
      );

      const actions = service.getAvailableTransitions(policy.id);

      expect(actions).toContain(PolicyTransitionAction.SUSPEND);
      expect(actions).toContain(PolicyTransitionAction.CANCEL);
      expect(actions).not.toContain(PolicyTransitionAction.SUBMIT_FOR_APPROVAL);
    });
  });
});
