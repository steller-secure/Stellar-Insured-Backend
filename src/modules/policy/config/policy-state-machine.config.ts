import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyTransitionAction } from '../enums/policy-transition-action.enum';
import { PolicyTransition } from '../types/policy-transition.types';

/**
 * Defines valid policy lifecycle transitions.
 * Each entry specifies allowed transitions from a source state.
 */
export const POLICY_STATE_TRANSITIONS: PolicyTransition[] = [
  // DRAFT transitions
  {
    from: PolicyStatus.DRAFT,
    to: PolicyStatus.PENDING,
    action: PolicyTransitionAction.SUBMIT_FOR_APPROVAL,
    allowedRoles: ['creator', 'admin'],
    requiresReason: false,
  },
  {
    from: PolicyStatus.DRAFT,
    to: PolicyStatus.CANCELLED,
    action: PolicyTransitionAction.CANCEL,
    allowedRoles: ['creator', 'admin'],
    requiresReason: true,
  },

  // PENDING transitions
  {
    from: PolicyStatus.PENDING,
    to: PolicyStatus.ACTIVE,
    action: PolicyTransitionAction.APPROVE,
    allowedRoles: ['approver', 'admin'],
    requiresReason: false,
  },
  {
    from: PolicyStatus.PENDING,
    to: PolicyStatus.DRAFT,
    action: PolicyTransitionAction.REJECT,
    allowedRoles: ['approver', 'admin'],
    requiresReason: true,
  },

  // ACTIVE transitions
  {
    from: PolicyStatus.ACTIVE,
    to: PolicyStatus.SUSPENDED,
    action: PolicyTransitionAction.SUSPEND,
    allowedRoles: ['admin', 'operator'],
    requiresReason: true,
  },
  {
    from: PolicyStatus.ACTIVE,
    to: PolicyStatus.CANCELLED,
    action: PolicyTransitionAction.CANCEL,
    allowedRoles: ['admin'],
    requiresReason: true,
  },
  {
    from: PolicyStatus.ACTIVE,
    to: PolicyStatus.EXPIRED,
    action: PolicyTransitionAction.EXPIRE,
    allowedRoles: ['admin', 'system'],
    requiresReason: false,
  },

  // SUSPENDED transitions
  {
    from: PolicyStatus.SUSPENDED,
    to: PolicyStatus.ACTIVE,
    action: PolicyTransitionAction.RESUME,
    allowedRoles: ['admin', 'operator'],
    requiresReason: false,
  },
  {
    from: PolicyStatus.SUSPENDED,
    to: PolicyStatus.CANCELLED,
    action: PolicyTransitionAction.CANCEL,
    allowedRoles: ['admin'],
    requiresReason: true,
  },

  // CANCELLED transitions
  {
    from: PolicyStatus.CANCELLED,
    to: PolicyStatus.LAPSED,
    action: PolicyTransitionAction.ARCHIVE,
    allowedRoles: ['admin'],
    requiresReason: false,
  },

  // EXPIRED transitions
  {
    from: PolicyStatus.EXPIRED,
    to: PolicyStatus.LAPSED,
    action: PolicyTransitionAction.ARCHIVE,
    allowedRoles: ['admin'],
    requiresReason: false,
  },
];

/**
 * Defines the state machine graph for quick lookup of valid transitions.
 * Maps from state to allowed transitions.
 */
export const POLICY_STATE_TRANSITIONS_MAP: Map<
  PolicyStatus,
  PolicyTransition[]
> = new Map(
  Object.values(PolicyStatus).map((status) => [
    status,
    POLICY_STATE_TRANSITIONS.filter((t) => t.from === status),
  ]),
);
