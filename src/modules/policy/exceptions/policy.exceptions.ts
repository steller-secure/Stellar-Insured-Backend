import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidPolicyTransitionException extends HttpException {
  constructor(status: string, action: string) {
    super(`Invalid transition: ${action} not allowed from ${status}`, HttpStatus.BAD_REQUEST);
  }
}

export class InsufficientPermissionsForTransitionException extends HttpException {
  constructor() {
    super('Insufficient permissions for this policy transition', HttpStatus.FORBIDDEN);
  }
}

export class MissingTransitionReasonException extends HttpException {
  constructor() {
    super('Reason is required for this transition', HttpStatus.BAD_REQUEST);
  }
}