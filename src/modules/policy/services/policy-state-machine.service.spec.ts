import { Test, TestingModule } from '@nestjs/testing';
import { PolicyStateMachineService } from './policy-state-machine.service';
import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyTransitionAction } from '../enums/policy-transition-action.enum';

describe('PolicyStateMachineService', () => {
  let service: PolicyStateMachineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyStateMachineService],
    }).compile();

    service = module.get<PolicyStateMachineService>(PolicyStateMachineService);
  });

  describe('validateTransition', () => {
    it('should allow DRAFT -> PENDING transition', () => {
      const transition = service.validateTransition(
        PolicyStatus.DRAFT,
        PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
      );
      expect(transition).toBeDefined();
      expect(transition.to).toBe(PolicyStatus.PENDING);
    });

    it('should reject DRAFT -> SUSPENDED transition', () => {
      // Fixed: Match by message to avoid constructor instance mismatch
      expect(() =>
        service.validateTransition(PolicyStatus.DRAFT, PolicyTransitionAction.SUSPEND),
      ).toThrow('Invalid transition');
    });

    it('should reject ACTIVE -> PENDING transition', () => {
      expect(() =>
        service.validateTransition(PolicyStatus.ACTIVE, PolicyTransitionAction.APPROVE),
      ).toThrow('Invalid transition');
    });
  });

  describe('validatePermission', () => {
    const transition = {
      from: PolicyStatus.DRAFT,
      to: PolicyStatus.PENDING,
      action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
      roles: ['creator', 'admin'],
    };

    it('should allow creator role', () => {
      expect(() => service.validatePermission(transition, 'creator')).not.toThrow();
    });

    it('should reject operator role', () => {
      expect(() => service.validatePermission(transition, 'operator')).toThrow(
        'Insufficient permissions',
      );
    });
  });

  describe('validateReason', () => {
    const transitionWithReason = {
      action: PolicyTransitionAction.SUSPEND,
      requiresReason: true,
    };

    it('should throw if reason is missing', () => {
      // Fixed: Match by message
      expect(() => service.validateReason(transitionWithReason)).toThrow(
        'Reason is required',
      );
    });

    it('should not throw if reason is provided', () => {
      expect(() =>
        service.validateReason(transitionWithReason, 'Valid reason'),
      ).not.toThrow();
    });
  });

  describe('canReachStatus', () => {
    it('should confirm DRAFT can reach ACTIVE', () => {
      const result = service.canReachStatus(PolicyStatus.DRAFT, PolicyStatus.ACTIVE);
      expect(result).toBe(true);
    });

    it('should return false for impossible transitions (ARCHIVED -> ACTIVE)', () => {
      const result = service.canReachStatus(PolicyStatus.ARCHIVED, PolicyStatus.ACTIVE);
      expect(result).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('should return empty array for ARCHIVED', () => {
      const transitions = service.getValidTransitions(PolicyStatus.ARCHIVED);
      expect(transitions.length).toBe(0);
    });
  });
});