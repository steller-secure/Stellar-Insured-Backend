import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Policy } from './entities/policy.entity';
import { PolicyStateMachineService } from './services/policy-state-machine.service';
import { PolicyAuditService } from './services/policy-audit.service';
import { PolicyStatus } from './enums/policy-status.enum';
import { PolicyTransitionAction } from './enums/policy-transition-action.enum';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  EventNames,
  PolicyIssuedEvent,
  PolicyRenewedEvent,
  PolicyExpiredEvent,
  PolicyCancelledEvent,
} from '../../events';
import { AuditService } from '../audit/services/audit.service';
import { AuditActionType } from '../audit/enums/audit-action-type.enum';

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
    private stateMachine: PolicyStateMachineService,
    private auditService: PolicyAuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogService: AuditService,
  ) {}

  /**
   * Creates a new policy in DRAFT status.
   */
  async createPolicy(dto: CreatePolicyDto, userId: string): Promise<Policy> {
    // Note: In a real app, we'd fetch the User entity first
    const policy = this.policyRepository.create({
      policyNumber: `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      status: PolicyStatus.DRAFT,
      coverageType: dto.coverageType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      premium: dto.premium,
    });

    const savedPolicy = await this.policyRepository.save(policy);
    this.logger.log(`Policy created: ${savedPolicy.id} in ${savedPolicy.status} status`);

    // Audit log the policy creation
    await this.auditLogService.logAction(
      AuditActionType.POLICY_CREATED,
      userId,
      savedPolicy.id,
      {
        policyNumber: savedPolicy.policyNumber,
        coverageType: savedPolicy.coverageType,
        premium: savedPolicy.premium,
      },
    );

    return savedPolicy;
  }

  /**
   * Transitions a policy to a new status with validation.
   * Emits domain events for notification handling.
   */
  async transitionPolicy(
    policyId: string,
    action: PolicyTransitionAction,
    userId: string,
    userRoles: string[],
    reason?: string,
  ): Promise<Policy> {
    const policy = await this.getPolicy(policyId);

    // Execute transition with full validation
    const { auditEntry, stateChangeEvent } =
      this.stateMachine.executeTransition(
        policy.status,
        action,
        userId,
        userRoles,
        policyId,
        reason,
      );

    // Update policy status
    policy.status = auditEntry.toStatus;
    await this.policyRepository.save(policy);

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
  async getPolicy(policyId: string): Promise<Policy> {
    const policy = await this.policyRepository.findOne({ where: { id: policyId } });
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    return policy;
  }

  /**
   * Gets all policies.
   */
  async getAllPolicies(): Promise<Policy[]> {
    return this.policyRepository.find();
  }

  /**
   * Gets policies by status.
   */
  async getPoliciesByStatus(status: PolicyStatus): Promise<Policy[]> {
    return this.policyRepository.find({ where: { status } });
  }

  /**
   * Gets the audit trail for a policy.
   */
  async getAuditTrail(policyId: string) {
    await this.getPolicy(policyId); // Verify policy exists
    return this.auditService.getAuditTrail(policyId);
  }

  /**
   * Gets available transitions for a policy.
   */
  async getAvailableTransitions(policyId: string) {
    const policy = await this.getPolicy(policyId);
    return this.stateMachine.getAvailableActions(policy.status);
  }

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
