import { Test, TestingModule } from '@nestjs/testing';
import { PolicyAuditService } from '../services/policy-audit.service';
import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyTransitionAction } from '../enums/policy-transition-action.enum';
import {
  PolicyAuditEntry,
  PolicyStateChangeEvent,
} from '../types/policy-transition.types';

describe('PolicyAuditService', () => {
  let service: PolicyAuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyAuditService],
    }).compile();

    service = module.get<PolicyAuditService>(PolicyAuditService);
  });

  afterEach(() => {
    service.clearAuditLog();
  });

  describe('recordAuditEntry', () => {
    it('should record an audit entry', () => {
      const entry: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: new Date(),
      };

      service.recordAuditEntry(entry);
      const trail = service.getAuditTrail('policy-123');

      expect(trail).toHaveLength(1);
      expect(trail[0]).toEqual(entry);
    });

    it('should record multiple audit entries for same policy', () => {
      const entry1: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: new Date(),
      };

      const entry2: PolicyAuditEntry = {
        id: '2',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.PENDING_APPROVAL,
        toStatus: PolicyStatus.APPROVED,
        action: PolicyTransitionAction.APPROVE,
        transitionedBy: 'approver-456',
        timestamp: new Date(Date.now() + 1000),
      };

      service.recordAuditEntry(entry1);
      service.recordAuditEntry(entry2);
      const trail = service.getAuditTrail('policy-123');

      expect(trail).toHaveLength(2);
    });
  });

  describe('publishStateChangeEvent', () => {
    it('should publish state change event', () => {
      const event: PolicyStateChangeEvent = {
        policyId: 'policy-123',
        previousStatus: PolicyStatus.DRAFT,
        newStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: new Date(),
      };

      expect(() => service.publishStateChangeEvent(event)).not.toThrow();
    });
  });

  describe('getAuditTrail', () => {
    it('should retrieve audit trail for policy', () => {
      const entry: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: new Date(),
      };

      service.recordAuditEntry(entry);
      const trail = service.getAuditTrail('policy-123');

      expect(trail).toHaveLength(1);
      expect(trail[0].policyId).toBe('policy-123');
    });

    it('should return empty array for non-existent policy', () => {
      const trail = service.getAuditTrail('non-existent');
      expect(trail).toEqual([]);
    });

    it('should filter entries by policy id', () => {
      const entry1: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: new Date(),
      };

      const entry2: PolicyAuditEntry = {
        id: '2',
        policyId: 'policy-456',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: new Date(),
      };

      service.recordAuditEntry(entry1);
      service.recordAuditEntry(entry2);

      const trail123 = service.getAuditTrail('policy-123');
      const trail456 = service.getAuditTrail('policy-456');

      expect(trail123).toHaveLength(1);
      expect(trail123[0].policyId).toBe('policy-123');
      expect(trail456).toHaveLength(1);
      expect(trail456[0].policyId).toBe('policy-456');
    });
  });

  describe('getAuditTrailByDateRange', () => {
    it('should retrieve audit entries within date range', () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 10000);
      const later = new Date(now.getTime() + 10000);

      const entry: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: now,
      };

      service.recordAuditEntry(entry);
      const trail = service.getAuditTrailByDateRange(
        'policy-123',
        earlier,
        later,
      );

      expect(trail).toHaveLength(1);
    });

    it('should exclude entries outside date range', () => {
      const now = new Date();
      const before = new Date(now.getTime() - 20000);
      const after = new Date(now.getTime() - 5000);

      const entry: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: now,
      };

      service.recordAuditEntry(entry);
      const trail = service.getAuditTrailByDateRange('policy-123', before, after);

      expect(trail).toHaveLength(0);
    });
  });

  describe('getAuditTrailByStatus', () => {
    it('should retrieve audit entries by source status', () => {
      const entry1: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: new Date(),
      };

      const entry2: PolicyAuditEntry = {
        id: '2',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.PENDING_APPROVAL,
        toStatus: PolicyStatus.APPROVED,
        action: PolicyTransitionAction.APPROVE,
        transitionedBy: 'approver-456',
        timestamp: new Date(Date.now() + 1000),
      };

      service.recordAuditEntry(entry1);
      service.recordAuditEntry(entry2);

      const trail = service.getAuditTrailByStatus(
        'policy-123',
        PolicyStatus.DRAFT,
      );

      expect(trail).toHaveLength(1);
      expect(trail[0].fromStatus).toBe(PolicyStatus.DRAFT);
    });
  });

  describe('getTransitionCount', () => {
    it('should return count of transitions for policy', () => {
      const entry1: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: new Date(),
      };

      const entry2: PolicyAuditEntry = {
        id: '2',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.PENDING_APPROVAL,
        toStatus: PolicyStatus.APPROVED,
        action: PolicyTransitionAction.APPROVE,
        transitionedBy: 'approver-456',
        timestamp: new Date(Date.now() + 1000),
      };

      service.recordAuditEntry(entry1);
      service.recordAuditEntry(entry2);

      const count = service.getTransitionCount('policy-123');
      expect(count).toBe(2);
    });

    it('should return 0 for policy with no transitions', () => {
      const count = service.getTransitionCount('non-existent');
      expect(count).toBe(0);
    });
  });

  describe('getTransitionHistory', () => {
    it('should return transition history with key details', () => {
      const entry1: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        reason: 'Initial submission',
        timestamp: new Date(),
      };

      service.recordAuditEntry(entry1);
      const history = service.getTransitionHistory('policy-123');

      expect(history).toHaveLength(1);
      expect(history[0].fromStatus).toBe(PolicyStatus.DRAFT);
      expect(history[0].toStatus).toBe(PolicyStatus.PENDING_APPROVAL);
      expect(history[0].transitionedBy).toBe('user-123');
      expect(history[0].reason).toBe('Initial submission');
    });
  });

  describe('verifyAuditTrailIntegrity', () => {
    it('should return true for valid chronological order', () => {
      const now = new Date();
      const entry1: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: now,
      };

      const entry2: PolicyAuditEntry = {
        id: '2',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.PENDING_APPROVAL,
        toStatus: PolicyStatus.APPROVED,
        action: PolicyTransitionAction.APPROVE,
        transitionedBy: 'approver-456',
        timestamp: new Date(now.getTime() + 1000),
      };

      service.recordAuditEntry(entry1);
      service.recordAuditEntry(entry2);

      const isValid = service.verifyAuditTrailIntegrity('policy-123');
      expect(isValid).toBe(true);
    });

    it('should return true for single entry', () => {
      const entry: PolicyAuditEntry = {
        id: '1',
        policyId: 'policy-123',
        fromStatus: PolicyStatus.DRAFT,
        toStatus: PolicyStatus.PENDING_APPROVAL,
        action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        transitionedBy: 'user-123',
        timestamp: new Date(),
      };

      service.recordAuditEntry(entry);
      const isValid = service.verifyAuditTrailIntegrity('policy-123');
      expect(isValid).toBe(true);
    });

    it('should return true for empty trail', () => {
      const isValid = service.verifyAuditTrailIntegrity('non-existent');
      expect(isValid).toBe(true);
    });
  });
});
