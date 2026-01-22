import { BadRequestException } from '@nestjs/common';
import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyTransitionAction } from '../enums/policy-transition-action.enum';

export class InvalidPolicyTransitionException extends BadRequestException {
  constructor(
    currentStatus: PolicyStatus,
    action: PolicyTransitionAction,
    reason?: string,
  ) {
    const message = reason
      ? `Invalid transition: Cannot perform '${action}' on policy in '${currentStatus}' status. ${reason}`
      : `Invalid transition: Cannot perform '${action}' on policy in '${currentStatus}' status.`;

    super({
      message,
      errorCode: 'INVALID_POLICY_TRANSITION',
      currentStatus,
      attemptedAction: action,
    });
  }
}

export class MissingTransitionReasonException extends BadRequestException {
  constructor(action: PolicyTransitionAction) {
    super({
      message: `Reason is required for transition action '${action}'`,
      errorCode: 'MISSING_TRANSITION_REASON',
      action,
    });
  }
}

export class InsufficientPermissionsForTransitionException extends BadRequestException {
  constructor(
    action: PolicyTransitionAction,
    requiredRoles: string[],
    userRole: string,
  ) {
    super({
      message: `User role '${userRole}' does not have permission to perform '${action}'. Required roles: ${requiredRoles.join(', ')}`,
      errorCode: 'INSUFFICIENT_PERMISSIONS_FOR_TRANSITION',
      action,
      requiredRoles,
      userRole,
    });
  }
}
