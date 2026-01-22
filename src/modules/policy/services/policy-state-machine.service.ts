import { Injectable, Logger } from '@nestjs/common';
import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyTransitionAction } from '../enums/policy-transition-action.enum';
import {
  PolicyTransition,
  PolicyAuditEntry,
  PolicyStateChangeEvent,
} from '../types/policy-transition.types';
import {
  InvalidPolicyTransitionException,
  MissingTransitionReasonException,
  InsufficientPermissionsForTransitionException,
} from '../exceptions/invalid-policy-transition.exception';
import {
  POLICY_STATE_TRANSITIONS,
  POLICY_STATE_TRANSITIONS_MAP,
} from '../config/policy-state-machine.config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PolicyStateMachineService {
  private readonly logger = new Logger(PolicyStateMachineService.name);

  /**
   * Validates if a transition from one status to another is allowed.
   * @param currentStatus - Current policy status
   * @param action - Requested transition action
   * @returns The valid transition if found
   * @throws InvalidPolicyTransitionException if transition is not allowed
   */
  validateTransition(
    currentStatus: PolicyStatus,
    action: PolicyTransitionAction,
  ): PolicyTransition {
    const validTransitions =
      POLICY_STATE_TRANSITIONS_MAP.get(currentStatus) || [];

    const transition = validTransitions.find((t) => t.action === action);

    if (!transition) {
      const availableActions = validTransitions
        .map((t) => t.action)
        .join(', ');
      const reason =
        availableActions.length > 0
          ? `Available actions: ${availableActions}`
          : 'No transitions allowed from this status';

      throw new InvalidPolicyTransitionException(
        currentStatus,
        action,
        reason,
      );
    }

    this.logger.debug(
      `Transition validated: ${currentStatus} -> ${transition.to} (${action})`,
    );

    return transition;
  }

  /**
   * Checks if a user has permission to perform a transition.
   * @param transition - The transition configuration
   * @param userRole - The user's role
   * @throws InsufficientPermissionsForTransitionException if user lacks permission
   */
  validatePermission(
    transition: PolicyTransition,
    userRole: string,
  ): void {
    if (
      transition.allowedRoles &&
      transition.allowedRoles.length > 0 &&
      !transition.allowedRoles.includes(userRole)
    ) {
      throw new InsufficientPermissionsForTransitionException(
        transition.action,
        transition.allowedRoles,
        userRole,
      );
    }

    this.logger.debug(
      `Permission validated for action ${transition.action} by role ${userRole}`,
    );
  }

  /**
   * Validates that a reason is provided if required for the transition.
   * @param transition - The transition configuration
   * @param reason - The provided reason (if any)
   * @throws MissingTransitionReasonException if reason is required but not provided
   */
  validateReason(
    transition: PolicyTransition,
    reason?: string,
  ): void {
    if (transition.requiresReason && !reason) {
      throw new MissingTransitionReasonException(transition.action);
    }

    this.logger.debug(
      `Reason validation passed for action ${transition.action}`,
    );
  }

  /**
   * Executes a policy state transition with full validation.
   * @param currentStatus - Current policy status
   * @param action - Requested transition action
   * @param userId - User performing the transition
   * @param userRole - User's role
   * @param policyId - Policy ID
   * @param reason - Optional reason for transition
   * @returns The audit entry and state change event
   */
  executeTransition(
    currentStatus: PolicyStatus,
    action: PolicyTransitionAction,
    userId: string,
    userRole: string,
    policyId: string,
    reason?: string,
  ): {
    auditEntry: PolicyAuditEntry;
    stateChangeEvent: PolicyStateChangeEvent;
  } {
    // Validate transition is allowed
    const transition = this.validateTransition(currentStatus, action);

    // Validate user has permission
    this.validatePermission(transition, userRole);

    // Validate reason if required
    this.validateReason(transition, reason);

    // Create audit entry
    const auditEntry: PolicyAuditEntry = {
      id: uuidv4(),
      policyId,
      fromStatus: currentStatus,
      toStatus: transition.to,
      action,
      transitionedBy: userId,
      reason,
      timestamp: new Date(),
      metadata: {
        userRole,
        ipAddress: null, // Can be populated from request context
      },
    };

    // Create state change event
    const stateChangeEvent: PolicyStateChangeEvent = {
      policyId,
      previousStatus: currentStatus,
      newStatus: transition.to,
      action,
      transitionedBy: userId,
      reason,
      timestamp: auditEntry.timestamp,
    };

    this.logger.log(
      `Policy transition executed: ${policyId} [${currentStatus} -> ${transition.to}] by ${userId}`,
    );

    return { auditEntry, stateChangeEvent };
  }

  /**
   * Gets all valid transitions from a given status.
   * @param status - Current policy status
   * @returns Array of valid transitions
   */
  getValidTransitions(status: PolicyStatus): PolicyTransition[] {
    return POLICY_STATE_TRANSITIONS_MAP.get(status) || [];
  }

  /**
   * Gets all available actions from a given status.
   * @param status - Current policy status
   * @returns Array of available actions
   */
  getAvailableActions(status: PolicyStatus): PolicyTransitionAction[] {
    return this.getValidTransitions(status).map((t) => t.action);
  }

  /**
   * Checks if a transition path exists between two states.
   * Uses BFS to find shortest path.
   * @param fromStatus - Source status
   * @param toStatus - Target status
   * @returns True if a path exists
   */
  canReachStatus(
    fromStatus: PolicyStatus,
    toStatus: PolicyStatus,
  ): boolean {
    if (fromStatus === toStatus) return true;

    const visited = new Set<PolicyStatus>();
    const queue: PolicyStatus[] = [fromStatus];
    visited.add(fromStatus);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const transitions = POLICY_STATE_TRANSITIONS_MAP.get(current) || [];

      for (const transition of transitions) {
        if (transition.to === toStatus) return true;

        if (!visited.has(transition.to)) {
          visited.add(transition.to);
          queue.push(transition.to);
        }
      }
    }

    return false;
  }
}
