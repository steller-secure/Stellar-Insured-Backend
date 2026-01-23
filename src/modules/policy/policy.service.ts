import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PolicyEntity } from './entities/policy.entity';
import { PolicyStateMachineService } from './services/policy-state-machine.service';
import { PolicyAuditService } from './services/policy-audit.service';
import { PolicyStatus } from './enums/policy-status.enum';
import { PolicyTransitionAction } from './enums/policy-transition-action.enum';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { randomUUID } from 'node:crypto';
import {
  EventNames,
  PolicyIssuedEvent,
  PolicyRenewedEvent,
  PolicyExpiredEvent,
  PolicyCancelledEvent,
} from '../../events';

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);
  private policies = new Map<string, PolicyEntity>();

  constructor(
    private stateMachine: PolicyStateMachineService,
    private auditService: PolicyAuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new policy in DRAFT status.
   */
  createPolicy(dto: CreatePolicyDto, userId: string): PolicyEntity {
    const policy = new PolicyEntity({
      id: randomUUID(),
      policyNumber: `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      status: PolicyStatus.DRAFT,
      customerId: dto.customerId,
      coverageType: dto.coverageType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      premium: dto.premium,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.policies.set(policy.id, policy);
    this.logger.log(`Policy created: ${policy.id} in ${policy.status} status`);

    return policy;
  }

  /**
   * Transitions a policy to a new status with validation.
   * Emits domain events for notification handling.
   */
  transitionPolicy(
    policyId: string,
    action: PolicyTransitionAction,
    userId: string,
    userRole: string,
    reason?: string,
  ): PolicyEntity {
    const policy = this.getPolicy(policyId);

    // Execute transition with full validation
    const { auditEntry, stateChangeEvent } =
      this.stateMachine.executeTransition(
        policy.getCurrentStatus(),
        action,
        userId,
        userRole,
        policyId,
        reason,
      );

    // Update policy status
    policy.transitionTo(auditEntry.toStatus, auditEntry);

    // Record audit trail
    this.auditService.recordAuditEntry(auditEntry);
    this.auditService.publishStateChangeEvent(stateChangeEvent);

    // Emit notification events based on the action
    this.emitPolicyEvent(action, policyId, userId, reason);

    this.logger.log(
      `Policy ${policyId} transitioned from ${auditEntry.fromStatus} to ${auditEntry.toStatus}`,
    );

    return policy;
  }

  /**
   * Emit policy-related notification events.
   */
  private emitPolicyEvent(
    action: PolicyTransitionAction,
    policyId: string,
    userId: string,
    reason?: string,
  ): void {
    switch (action) {
      case PolicyTransitionAction.ACTIVATE:
        this.eventEmitter.emit(
          EventNames.POLICY_ISSUED,
          new PolicyIssuedEvent(policyId, userId),
        );
        break;
      case PolicyTransitionAction.RENEW:
        this.eventEmitter.emit(
          EventNames.POLICY_RENEWED,
          new PolicyRenewedEvent(policyId, userId),
        );
        break;
      case PolicyTransitionAction.EXPIRE:
        this.eventEmitter.emit(
          EventNames.POLICY_EXPIRED,
          new PolicyExpiredEvent(policyId, userId),
        );
        break;
      case PolicyTransitionAction.CANCEL:
        this.eventEmitter.emit(
          EventNames.POLICY_CANCELLED,
          new PolicyCancelledEvent(policyId, userId, reason || 'Cancelled'),
        );
        break;
    }
  }

  /**
   * Retrieves a policy by ID.
   */
  getPolicy(policyId: string): PolicyEntity {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    return policy;
  }

  /**
   * Gets all policies.
   */
  getAllPolicies(): PolicyEntity[] {
    return Array.from(this.policies.values());
  }

  /**
   * Gets policies by status.
   */
  getPoliciesByStatus(status: PolicyStatus): PolicyEntity[] {
    return Array.from(this.policies.values()).filter(p => p.status === status);
  }

  /**
   * Gets the audit trail for a policy.
   */
  getAuditTrail(policyId: string) {
    this.getPolicy(policyId); // Verify policy exists
    return this.auditService.getAuditTrail(policyId);
  }

  /**
   * Gets available transitions for a policy.
   */
  getAvailableTransitions(policyId: string) {
    const policy = this.getPolicy(policyId);
    return this.stateMachine.getAvailableActions(policy.getCurrentStatus());
  }

  // ===== Simplified methods for notification event testing =====

  /**
   * Issue a new policy (simplified for event emission).
   */
  issuePolicy(
    policyId: string,
    userId: string,
  ): { policyId: string; status: string } {
    this.eventEmitter.emit(
      EventNames.POLICY_ISSUED,
      new PolicyIssuedEvent(policyId, userId),
    );
    return { policyId, status: 'issued' };
  }

  /**
   * Renew a policy (simplified for event emission).
   */
  renewPolicy(
    policyId: string,
    userId: string,
  ): { policyId: string; status: string } {
    this.eventEmitter.emit(
      EventNames.POLICY_RENEWED,
      new PolicyRenewedEvent(policyId, userId),
    );
    return { policyId, status: 'renewed' };
  }

  /**
   * Mark a policy as expired (simplified for event emission).
   */
  expirePolicy(
    policyId: string,
    userId: string,
  ): { policyId: string; status: string } {
    this.eventEmitter.emit(
      EventNames.POLICY_EXPIRED,
      new PolicyExpiredEvent(policyId, userId),
    );
    return { policyId, status: 'expired' };
  }

  /**
   * Cancel a policy (simplified for event emission).
   */
  cancelPolicy(
    policyId: string,
    userId: string,
    reason: string,
  ): { policyId: string; status: string } {
    this.eventEmitter.emit(
      EventNames.POLICY_CANCELLED,
      new PolicyCancelledEvent(policyId, userId, reason),
    );
    return { policyId, status: 'cancelled' };
  }
}
