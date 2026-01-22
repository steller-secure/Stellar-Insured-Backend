import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyTransitionAction } from '../enums/policy-transition-action.enum';

export interface PolicyTransition {
  from: PolicyStatus;
  to: PolicyStatus;
  action: PolicyTransitionAction;
  allowedRoles?: string[];
  requiresReason?: boolean;
}

export interface PolicyAuditEntry {
  id: string;
  policyId: string;
  fromStatus: PolicyStatus;
  toStatus: PolicyStatus;
  action: PolicyTransitionAction;
  transitionedBy: string;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PolicyStateChangeEvent {
  policyId: string;
  previousStatus: PolicyStatus;
  newStatus: PolicyStatus;
  action: PolicyTransitionAction;
  transitionedBy: string;
  reason?: string;
  timestamp: Date;
}
