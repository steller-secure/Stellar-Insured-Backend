import { Injectable, Logger } from '@nestjs/common';
import { PolicyEntity } from './entities/policy.entity';
import { PolicyStateMachineService } from './services/policy-state-machine.service';
import { PolicyAuditService } from './services/policy-audit.service';
import { PolicyStatus } from './enums/policy-status.enum';
import { PolicyTransitionAction } from './enums/policy-transition-action.enum';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);
  private policies = new Map<string, PolicyEntity>();

  constructor(
    private stateMachine: PolicyStateMachineService,
    private auditService: PolicyAuditService,
  ) {}

  /**
   * Creates a new policy in DRAFT status.
   */
  createPolicy(
    dto: CreatePolicyDto,
    userId: string,
  ): PolicyEntity {
    const policy = new PolicyEntity({
      id: uuidv4(),
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

    this.logger.log(
      `Policy ${policyId} transitioned from ${auditEntry.fromStatus} to ${auditEntry.toStatus}`,
    );

    return policy;
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
    return Array.from(this.policies.values()).filter(
      (p) => p.status === status,
    );
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
}
