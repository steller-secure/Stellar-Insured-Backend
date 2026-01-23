import { HttpException, HttpStatus } from '@nestjs/common';

export class PolicyNotFoundException extends HttpException {
  constructor(policyId: string) {
    super(
      `Policy with ID ${policyId} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PolicyInactiveException extends HttpException {
  constructor(policyId: string) {
    super(
      `Policy with ID ${policyId} is not active`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PolicyUnauthorizedException extends HttpException {
  constructor(policyId: string, userId: string) {
    super(
      `Policy with ID ${policyId} does not belong to user ${userId}`,
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ClaimOutOfCoveragePeriodException extends HttpException {
  constructor(incidentDate: Date, startDate: Date, endDate: Date) {
    super(
      `Incident date ${incidentDate.toISOString()} is outside policy coverage period (${startDate.toISOString()} - ${endDate.toISOString()})`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class CoverageExceededException extends HttpException {
  constructor(policyId: string) {
    super(
      `Policy with ID ${policyId} has exceeded its coverage limit`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ClaimTypeNotCoveredException extends HttpException {
  constructor(claimType: string, policyId: string) {
    super(
      `Claim type ${claimType} is not covered under policy ${policyId}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DuplicateClaimDetectedException extends HttpException {
  constructor(duplicateClaimId: string, matchPercentage: number) {
    super(
      {
        message: 'Potential duplicate claim detected',
        duplicateClaimId,
        matchPercentage,
        status: 'FLAGGED_FOR_REVIEW',
      },
      HttpStatus.CONFLICT,
    );
  }
}
