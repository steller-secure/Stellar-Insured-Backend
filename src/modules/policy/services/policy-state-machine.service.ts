import { Injectable, Logger } from '@nestjs/common';
import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyTransitionAction } from '../enums/policy-transition-action.enum';
import * as Exceptions from '../exceptions/policy.exceptions';

@Injectable()
export class PolicyStateMachineService {
  private readonly logger = new Logger(PolicyStateMachineService.name);

  private readonly transitions = [
    { from: PolicyStatus.DRAFT, to: PolicyStatus.PENDING as any, action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL, roles: ['creator', 'admin'] },
    { from: PolicyStatus.PENDING as any, to: PolicyStatus.ACTIVE, action: PolicyTransitionAction.APPROVE, roles: ['approver', 'admin'] },
    { from: PolicyStatus.ACTIVE, to: PolicyStatus.SUSPENDED, action: PolicyTransitionAction.SUSPEND, roles: ['admin', 'operator'], requiresReason: true },
    { from: PolicyStatus.SUSPENDED, to: PolicyStatus.ACTIVE, action: PolicyTransitionAction.RESUME, roles: ['admin'] },
    { from: PolicyStatus.ACTIVE, to: PolicyStatus.CANCELLED, action: PolicyTransitionAction.CANCEL, roles: ['admin', 'creator'], requiresReason: true },
  ];

  validateTransition(currentStatus: PolicyStatus, action: PolicyTransitionAction) {
    const transition = this.transitions.find(
      (t) => t.from === currentStatus && t.action === action,
    );
    if (!transition) throw new Exceptions.InvalidPolicyTransitionException(currentStatus, action);
    return transition;
  }

  validatePermission(transition: any, userRoles: string | string[]) {
    const rolesArray = Array.isArray(userRoles) ? userRoles : [userRoles];
    const hasPermission = transition.roles.some((role) => rolesArray.includes(role));
    if (!hasPermission) throw new Exceptions.InsufficientPermissionsForTransitionException();
  }

  validateReason(transition: any, reason?: string) {
    if (transition.requiresReason && !reason) {
      throw new Exceptions.MissingTransitionReasonException();
    }
  }

  executeTransition(currentStatus: PolicyStatus, action: PolicyTransitionAction, userRoles: string | string[], reason?: string) {
    const transition = this.validateTransition(currentStatus, action);
    this.validatePermission(transition, userRoles);
    this.validateReason(transition, reason);
    return { ...transition, timestamp: new Date(), reason };
  }

  // FIXED: Stronger terminal check to ensure ARCHIVED returns 0 transitions
 getValidTransitions(status: PolicyStatus) {
    // Remove PolicyStatus.ARCHIVED if it doesn't exist in your Enum
    const terminalValues = [PolicyStatus.CANCELLED, (PolicyStatus as any).EXPIRED];
    if (terminalValues.includes(status as any) || String(status) === 'ARCHIVED') {
      return [];
    }
    return this.transitions.filter((t) => t.from === status);
  }

  getAvailableActions(status: PolicyStatus) {
    return this.getValidTransitions(status).map((t) => t.action);
  }

  canReachStatus(currentStatus: PolicyStatus, targetStatus: PolicyStatus): boolean {
    if (currentStatus === targetStatus) return true;
    
    // If we start at a terminal status, we can't go anywhere else
    if (this.getValidTransitions(currentStatus).length === 0) return false;

    const visited = new Set<PolicyStatus>();
    const queue: PolicyStatus[] = [currentStatus];

    while (queue.length > 0) {
      const status = queue.shift()!;
      if (status === targetStatus) return true;

      if (!visited.has(status)) {
        visited.add(status);
        const neighbors = this.getValidTransitions(status);
        for (const edge of neighbors) {
          queue.push(edge.to);
        }
      }
    }
    return false;
  }
}