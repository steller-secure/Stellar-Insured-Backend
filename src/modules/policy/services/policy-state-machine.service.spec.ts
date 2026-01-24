import { Test, TestingModule } from '@nestjs/testing';
import { PolicyStateMachineService } from '../services/policy-state-machine.service';
import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyTransitionAction } from '../enums/policy-transition-action.enum';
import {
  InvalidPolicyTransitionException,
  MissingTransitionReasonException,
  InsufficientPermissionsForTransitionException,
} from '../exceptions/invalid-policy-transition.exception';

describe('PolicyStateMachineService', () => {
  let service: PolicyStateMachineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyStateMachineService],
    }).compile();

    service = module.get<PolicyStateMachineService>(PolicyStateMachineService);
  });

  describe('validateTransition', () => {
    it('should allow DRAFT -> PENDING_APPROVAL transition', () => {
      const transition = service.validateTransition(
        PolicyStatus.DRAFT,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
      );

      expect(transition).toBeDefined();
      expect(transition.from).toBe(PolicyStatus.DRAFT);
      expect(transition.to).toBe(PolicyStatus.PENDING_APPROVAL);
      expect(transition.action).toBe(
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
      );
    });

    it('should allow PENDING_APPROVAL -> APPROVED transition', () => {
      const transition = service.validateTransition(
        PolicyStatus.PENDING_APPROVAL,
        PolicyTransitionAction.APPROVE,
      );

      expect(transition).toBeDefined();
      expect(transition.from).toBe(PolicyStatus.PENDING_APPROVAL);
      expect(transition.to).toBe(PolicyStatus.APPROVED);
      expect(transition.action).toBe(PolicyTransitionAction.APPROVE);
    });

    it('should allow APPROVED -> ACTIVE transition', () => {
      const transition = service.validateTransition(
        PolicyStatus.APPROVED,
        PolicyTransitionAction.ACTIVATE,
      );

      expect(transition).toBeDefined();
      expect(transition.from).toBe(PolicyStatus.APPROVED);
      expect(transition.to).toBe(PolicyStatus.ACTIVE);
    });

    it('should allow ACTIVE -> SUSPENDED transition', () => {
      const transition = service.validateTransition(
        PolicyStatus.ACTIVE,
        PolicyTransitionAction.SUSPEND,
      );

      expect(transition).toBeDefined();
      expect(transition.from).toBe(PolicyStatus.ACTIVE);
      expect(transition.to).toBe(PolicyStatus.SUSPENDED);
    });

    it('should allow SUSPENDED -> ACTIVE transition', () => {
      const transition = service.validateTransition(
        PolicyStatus.SUSPENDED,
        PolicyTransitionAction.RESUME,
      );

      expect(transition).toBeDefined();
      expect(transition.from).toBe(PolicyStatus.SUSPENDED);
      expect(transition.to).toBe(PolicyStatus.ACTIVE);
    });

    it('should reject DRAFT -> SUSPENDED transition', () => {
      expect(() => {
        service.validateTransition(
          PolicyStatus.DRAFT,
          PolicyTransitionAction.SUSPEND,
        );
      }).toThrow(InvalidPolicyTransitionException);
    });

    it('should reject ACTIVE -> PENDING_APPROVAL transition', () => {
      expect(() => {
        service.validateTransition(
          PolicyStatus.ACTIVE,
          PolicyTransitionAction.APPROVE,
        );
      }).toThrow(InvalidPolicyTransitionException);
    });

    it('should reject EXPIRED -> ACTIVE transition', () => {
      expect(() => {
        service.validateTransition(
          PolicyStatus.EXPIRED,
          PolicyTransitionAction.ACTIVATE,
        );
      }).toThrow(InvalidPolicyTransitionException);
    });

    it('should reject ARCHIVED -> any transition', () => {
      expect(() => {
        service.validateTransition(
          PolicyStatus.ARCHIVED,
          PolicyTransitionAction.SUSPEND,
        );
      }).toThrow(InvalidPolicyTransitionException);
    });
  });

  describe('validatePermission', () => {
    it('should allow admin to perform admin-only transitions', () => {
      const transition = service.validateTransition(
        PolicyStatus.DRAFT,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
      );

      expect(() =>
        service.validatePermission(transition, 'admin'),
      ).not.toThrow();
    });

    it('should allow creator to submit for approval', () => {
      const transition = service.validateTransition(
        PolicyStatus.DRAFT,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
      );

      expect(() =>
        service.validatePermission(transition, 'creator'),
      ).not.toThrow();
    });

    it('should reject non-approver from approving', () => {
      const transition = service.validateTransition(
        PolicyStatus.PENDING_APPROVAL,
        PolicyTransitionAction.APPROVE,
      );

      expect(() => service.validatePermission(transition, 'creator')).toThrow(
        InsufficientPermissionsForTransitionException,
      );
    });

    it('should reject operator from cancelling policy', () => {
      const transition = service.validateTransition(
        PolicyStatus.APPROVED,
        PolicyTransitionAction.CANCEL,
      );

      expect(() => service.validatePermission(transition, 'operator')).toThrow(
        InsufficientPermissionsForTransitionException,
      );
    });

    it('should allow approver to approve', () => {
      const transition = service.validateTransition(
        PolicyStatus.PENDING_APPROVAL,
        PolicyTransitionAction.APPROVE,
      );

      expect(() =>
        service.validatePermission(transition, 'approver'),
      ).not.toThrow();
    });
  });

  describe('validateReason', () => {
    it('should reject cancel action without reason', () => {
      const transition = service.validateTransition(
        PolicyStatus.DRAFT,
        PolicyTransitionAction.CANCEL,
      );

      expect(() => service.validateReason(transition)).toThrow(
        MissingTransitionReasonException,
      );
    });

    it('should accept cancel action with reason', () => {
      const transition = service.validateTransition(
        PolicyStatus.DRAFT,
        PolicyTransitionAction.CANCEL,
      );

      expect(() =>
        service.validateReason(transition, 'Customer request'),
      ).not.toThrow();
    });

    it('should reject suspend action without reason', () => {
      const transition = service.validateTransition(
        PolicyStatus.ACTIVE,
        PolicyTransitionAction.SUSPEND,
      );

      expect(() => service.validateReason(transition)).toThrow(
        MissingTransitionReasonException,
      );
    });

    it('should accept submit without reason', () => {
      const transition = service.validateTransition(
        PolicyStatus.DRAFT,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
      );

      expect(() => service.validateReason(transition)).not.toThrow();
    });
  });

  describe('executeTransition', () => {
    it('should execute valid transition and return audit entry and event', () => {
      const result = service.executeTransition(
        PolicyStatus.DRAFT,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        'user-123',
        'creator',
        'policy-456',
      );

      expect(result.auditEntry).toBeDefined();
      expect(result.auditEntry.fromStatus).toBe(PolicyStatus.DRAFT);
      expect(result.auditEntry.toStatus).toBe(PolicyStatus.PENDING_APPROVAL);
      expect(result.auditEntry.transitionedBy).toBe('user-123');
      expect(result.auditEntry.policyId).toBe('policy-456');

      expect(result.stateChangeEvent).toBeDefined();
      expect(result.stateChangeEvent.previousStatus).toBe(PolicyStatus.DRAFT);
      expect(result.stateChangeEvent.newStatus).toBe(
        PolicyStatus.PENDING_APPROVAL,
      );
    });

    it('should include reason in audit entry when provided', () => {
      const result = service.executeTransition(
        PolicyStatus.ACTIVE,
        PolicyTransitionAction.SUSPEND,
        'user-123',
        'admin',
        'policy-456',
        'Policy review pending',
      );

      expect(result.auditEntry.reason).toBe('Policy review pending');
      expect(result.stateChangeEvent.reason).toBe('Policy review pending');
    });

    it('should fail if invalid transition is attempted', () => {
      expect(() => {
        service.executeTransition(
          PolicyStatus.DRAFT,
          PolicyTransitionAction.SUSPEND,
          'user-123',
          'admin',
          'policy-456',
        );
      }).toThrow(InvalidPolicyTransitionException);
    });

    it('should fail if user lacks permission', () => {
      expect(() => {
        service.executeTransition(
          PolicyStatus.PENDING_APPROVAL,
          PolicyTransitionAction.APPROVE,
          'user-123',
          'creator',
          'policy-456',
        );
      }).toThrow(InsufficientPermissionsForTransitionException);
    });

    it('should fail if required reason is missing', () => {
      expect(() => {
        service.executeTransition(
          PolicyStatus.ACTIVE,
          PolicyTransitionAction.SUSPEND,
          'user-123',
          'admin',
          'policy-456',
        );
      }).toThrow(MissingTransitionReasonException);
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions from DRAFT', () => {
      const transitions = service.getValidTransitions(PolicyStatus.DRAFT);

      expect(transitions).toBeDefined();
      expect(transitions.length).toBeGreaterThan(0);
      expect(
        transitions.some(
          t => t.action === PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
        ),
      ).toBe(true);
      expect(
        transitions.some(t => t.action === PolicyTransitionAction.CANCEL),
      ).toBe(true);
    });

    it('should return valid transitions from ACTIVE', () => {
      const transitions = service.getValidTransitions(PolicyStatus.ACTIVE);

      expect(transitions).toBeDefined();
      expect(transitions.length).toBeGreaterThan(0);
      expect(
        transitions.some(t => t.action === PolicyTransitionAction.SUSPEND),
      ).toBe(true);
    });

    it('should return empty array for ARCHIVED', () => {
      const transitions = service.getValidTransitions(PolicyStatus.ARCHIVED);
      expect(transitions.length).toBe(0);
    });
  });

  describe('getAvailableActions', () => {
    it('should return available actions from DRAFT', () => {
      const actions = service.getAvailableActions(PolicyStatus.DRAFT);

      expect(actions).toContain(PolicyTransitionAction.SUBMIT_FOR_APPROVAL);
      expect(actions).toContain(PolicyTransitionAction.CANCEL);
    });

    it('should return available actions from ACTIVE', () => {
      const actions = service.getAvailableActions(PolicyStatus.ACTIVE);

      expect(actions).toContain(PolicyTransitionAction.SUSPEND);
      expect(actions).toContain(PolicyTransitionAction.CANCEL);
    });
  });

  describe('canReachStatus', () => {
    it('should confirm DRAFT can reach ACTIVE', () => {
      const result = service.canReachStatus(
        PolicyStatus.DRAFT,
        PolicyStatus.ACTIVE,
      );
      expect(result).toBe(true);
    });

    it('should confirm PENDING_APPROVAL can reach ACTIVE', () => {
      const result = service.canReachStatus(
        PolicyStatus.PENDING_APPROVAL,
        PolicyStatus.ACTIVE,
      );
      expect(result).toBe(true);
    });

    it('should return same status check as true', () => {
      const result = service.canReachStatus(
        PolicyStatus.ACTIVE,
        PolicyStatus.ACTIVE,
      );
      expect(result).toBe(true);
    });

    it('should return false if path does not exist', () => {
      const result = service.canReachStatus(
        PolicyStatus.ARCHIVED,
        PolicyStatus.ACTIVE,
      );
      expect(result).toBe(false);
    });

    it('should return false for impossible transitions', () => {
      const result = service.canReachStatus(
        PolicyStatus.EXPIRED,
        PolicyStatus.ACTIVE,
      );
      expect(result).toBe(false);
    });
  });
});
