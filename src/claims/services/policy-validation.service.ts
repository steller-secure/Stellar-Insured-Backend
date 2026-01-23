import { Injectable, Logger } from '@nestjs/common';
import {
  PolicyNotFoundException,
  PolicyInactiveException,
  PolicyUnauthorizedException,
  ClaimOutOfCoveragePeriodException,
  CoverageExceededException,
  ClaimTypeNotCoveredException,
} from '../exceptions/claim.exceptions';
import { ClaimType } from '../entities/claim.entity';

// Mock policy interface - replace with actual Policy entity when integrating with PolicyModule
interface Policy {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'CANCELLED';
  startDate: Date;
  endDate: Date;
  coverageLimit: number;
  usedAmount: number;
  coveredClaimTypes: ClaimType[];
  terms: Record<string, any>;
}

@Injectable()
export class PolicyValidationService {
  private readonly logger = new Logger(PolicyValidationService.name);

  // Mock policy storage - replace with actual database queries
  private mockPolicies: Map<string, Policy> = new Map();

  constructor() {
    // Initialize with mock data for testing
    this.initializeMockPolicies();
  }

  private initializeMockPolicies(): void {
    this.mockPolicies.set('policy-123', {
      id: 'policy-123',
      userId: 'user-123',
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      coverageLimit: 100000,
      usedAmount: 25000,
      coveredClaimTypes: [
        ClaimType.ACCIDENT,
        ClaimType.THEFT,
        ClaimType.WEATHER_DAMAGE,
      ],
      terms: {},
    });
  }

  /**
   * Validates that the policy exists and belongs to the claiming user
   */
  async validatePolicyOwnership(
    policyId: string,
    userId: string,
  ): Promise<Policy> {
    this.logger.debug(
      `Validating policy ownership for policy ${policyId} and user ${userId}`,
    );

    const policy = this.mockPolicies.get(policyId);

    if (!policy) {
      this.logger.warn(`Policy ${policyId} not found`);
      throw new PolicyNotFoundException(policyId);
    }

    if (policy.userId !== userId) {
      this.logger.warn(
        `Unauthorized access attempt: policy ${policyId} does not belong to user ${userId}`,
      );
      throw new PolicyUnauthorizedException(policyId, userId);
    }

    return policy;
  }

  /**
   * Validates that the policy is in ACTIVE status
   */
  validatePolicyStatus(policy: Policy): void {
    this.logger.debug(`Validating policy status for policy ${policy.id}`);

    if (policy.status !== 'ACTIVE') {
      this.logger.warn(`Policy ${policy.id} is not active, status: ${policy.status}`);
      throw new PolicyInactiveException(policy.id);
    }
  }

  /**
   * Validates that the claim date falls within the policy coverage period
   */
  validateCoveragePeriod(policy: Policy, incidentDate: Date): void {
    this.logger.debug(
      `Validating coverage period for policy ${policy.id}, incident date: ${incidentDate.toISOString()}`,
    );

    if (incidentDate < policy.startDate || incidentDate > policy.endDate) {
      this.logger.warn(
        `Incident date ${incidentDate.toISOString()} is outside coverage period for policy ${policy.id}`,
      );
      throw new ClaimOutOfCoveragePeriodException(
        incidentDate,
        policy.startDate,
        policy.endDate,
      );
    }
  }

  /**
   * Validates that the policy has sufficient coverage remaining
   */
  validateCoverageLimit(policy: Policy, claimAmount: number): void {
    this.logger.debug(
      `Validating coverage limit for policy ${policy.id}, claim amount: ${claimAmount}`,
    );

    const remainingCoverage = policy.coverageLimit - policy.usedAmount;

    if (claimAmount > remainingCoverage) {
      this.logger.warn(
        `Claim amount ${claimAmount} exceeds remaining coverage ${remainingCoverage} for policy ${policy.id}`,
      );
      throw new CoverageExceededException(policy.id);
    }
  }

  /**
   * Validates that the claim type is covered under the policy
   */
  validateClaimTypeIsoCovered(policy: Policy, claimType: ClaimType): void {
    this.logger.debug(
      `Validating claim type ${claimType} for policy ${policy.id}`,
    );

    if (!policy.coveredClaimTypes.includes(claimType)) {
      this.logger.warn(
        `Claim type ${claimType} is not covered under policy ${policy.id}`,
      );
      throw new ClaimTypeNotCoveredException(claimType, policy.id);
    }
  }

  /**
   * Comprehensive policy validation
   */
  async validatePolicyForClaim(
    policyId: string,
    userId: string,
    claimType: ClaimType,
    incidentDate: Date,
    claimAmount: number,
  ): Promise<Policy> {
    const policy = await this.validatePolicyOwnership(policyId, userId);
    this.validatePolicyStatus(policy);
    this.validateCoveragePeriod(policy, incidentDate);
    this.validateCoverageLimit(policy, claimAmount);
    this.validateClaimTypeIsoCovered(policy, claimType);

    this.logger.log(
      `Policy validation successful for policy ${policyId}, user ${userId}`,
    );
    return policy;
  }
}
