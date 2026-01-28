import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Claim, ClaimStatus } from '../entities/claim.entity';
import { CreateClaimDto } from '../dto/create-claim.dto';
import { PolicyValidationService } from './policy-validation.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { DuplicateClaimDetectedException } from '../exceptions/claim.exceptions';
import { AuditService } from '../../modules/audit/services/audit.service';
import { AuditActionType } from '../../modules/audit/enums/audit-action-type.enum';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { PaginatedResult } from 'src/common/pagination/interfaces/paginated-result.interface';
import { paginate } from 'src/common/pagination/pagination.util';

@Injectable()
export class ClaimService {
  private readonly logger = new Logger(ClaimService.name);

  constructor(
    private claimRepository: Repository<Claim>,
    private policyValidationService: PolicyValidationService,
    private duplicateDetectionService: DuplicateDetectionService,
    private auditService: AuditService,
  ) {}

  /**
   * Creates a new claim with full validation and duplicate detection
   */
  async createClaim(
    userId: string,
    createClaimDto: CreateClaimDto,
  ): Promise<Claim> {
    this.logger.log(`Creating new claim for user ${userId}`);

    // Step 1: Validate policy eligibility
    this.logger.debug(
      `Step 1: Validating policy for claim creation`,
    );
    await this.policyValidationService.validatePolicyForClaim(
      createClaimDto.policyId,
      userId,
      createClaimDto.claimType,
      createClaimDto.incidentDate,
      createClaimDto.claimAmount,
    );

    // Step 2: Check for duplicate claims
    this.logger.debug(`Step 2: Checking for duplicate claims`);
    const duplicateResult = await this.duplicateDetectionService.detectDuplicates(
      createClaimDto.policyId,
      createClaimDto.incidentDate,
      createClaimDto.claimAmount,
      createClaimDto.description,
    );

    // Step 3: Create the claim
    this.logger.debug(`Step 3: Creating claim in database`);
    const claim = this.claimRepository.create({
      userId,
      policyId: createClaimDto.policyId,
      claimType: createClaimDto.claimType,
      incidentDate: createClaimDto.incidentDate,
      claimAmount: createClaimDto.claimAmount,
      description: createClaimDto.description,
      metadata: createClaimDto.metadata || {},
      status: ClaimStatus.SUBMITTED,
      flaggedForManualReview: !!duplicateResult,
    });

    const savedClaim = await this.claimRepository.save(claim);
    this.logger.log(`Claim ${savedClaim.id} created successfully`);

    // Audit log the claim submission
    await this.auditService.logAction(
      AuditActionType.CLAIM_SUBMITTED,
      userId,
      savedClaim.id,
      {
        claimAmount: savedClaim.claimAmount,
        policyId: savedClaim.policyId,
        claimType: savedClaim.claimType,
      },
    );

    // Step 4: Record duplicate detection (if found)
    if (duplicateResult) {
      this.logger.warn(
        `Duplicate claim detected for claim ${savedClaim.id}: ${duplicateResult.duplicateClaimId}`,
      );
      await this.duplicateDetectionService.recordDuplicateCheck(
        savedClaim.id,
        createClaimDto.policyId,
        duplicateResult.duplicateClaimId,
        duplicateResult.matchPercentage,
        duplicateResult.detectionMethod,
      );

      // Flag for manual review but don't auto-reject
      throw new DuplicateClaimDetectedException(
        duplicateResult.duplicateClaimId,
        duplicateResult.matchPercentage,
      );
    }

    return savedClaim;
  }

  /**
   * Retrieve a claim by ID
   */
  async getClaimById(claimId: string): Promise<Claim | null> {
    this.logger.debug(`Retrieving claim ${claimId}`);
    return this.claimRepository.findOne({ where: { id: claimId } });
  }

  /**
   * Retrieve all claims for a user
   */
  async getClaimsByUserId(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Claim>> {
    this.logger.debug(`Retrieving all claims for user ${userId}`);
    const queryBuilder = this.claimRepository.createQueryBuilder('claim');
    queryBuilder
      .where('claim.userId = :userId', { userId })
      .orderBy('claim.createdAt', 'DESC');

    return paginate(queryBuilder, paginationDto);
  }

  /**
   * Retrieve all claims for a policy
   */
  async getClaimsByPolicyId(
    policyId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Claim>> {
    this.logger.debug(`Retrieving all claims for policy ${policyId}`);
    const queryBuilder = this.claimRepository.createQueryBuilder('claim');
    queryBuilder
      .where('claim.policyId = :policyId', { policyId })
      .orderBy('claim.createdAt', 'DESC');

    return paginate(queryBuilder, paginationDto);
  }

  /**
   * Update claim status with optional notes
   */
  async updateClaimStatus(
    claimId: string,
    newStatus: ClaimStatus,
    reviewedBy: string,
    notes?: string,
  ): Promise<Claim> {
    this.logger.log(
      `Updating claim ${claimId} status to ${newStatus}`,
    );

    const claim = await this.claimRepository.findOne({ where: { id: claimId } });

    if (!claim) {
      this.logger.error(`Claim ${claimId} not found`);
      throw new Error(`Claim ${claimId} not found`);
    }

    claim.status = newStatus;
    claim.reviewedBy = reviewedBy;
    claim.reviewedAt = new Date();

    if (newStatus === ClaimStatus.REJECTED && notes) {
      claim.rejectionReason = notes;
    } else if (newStatus === ClaimStatus.APPROVED && notes) {
      claim.approvalNotes = notes;
    }

    const updated = await this.claimRepository.save(claim);
    this.logger.log(`Claim ${claimId} updated successfully`);

    return updated;
  }

  /**
   * Get claims flagged for manual review
   */
  async getFlaggedClaims(): Promise<Claim[]> {
    this.logger.debug(`Retrieving claims flagged for manual review`);
    return this.claimRepository.find({
      where: { flaggedForManualReview: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get claims by status
   */
  async getClaimsByStatus(status: ClaimStatus): Promise<Claim[]> {
    this.logger.debug(`Retrieving claims with status ${status}`);
    return this.claimRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get claim statistics for a policy
   */
  async getPolicyClaimStats(policyId: string): Promise<{
    totalClaims: number;
    totalClaimAmount: number;
    claimsByStatus: Record<ClaimStatus, number>;
    flaggedCount: number;
  }> {
    const claims = await this.claimRepository.find({
      where: { policyId },
    });

    const stats = {
      totalClaims: claims.length,
      totalClaimAmount: claims.reduce((sum, c) => sum + Number(c.claimAmount), 0),
      claimsByStatus: {} as Record<ClaimStatus, number>,
      flaggedCount: claims.filter((c) => c.flaggedForManualReview).length,
    };

    // Count claims by status
    Object.values(ClaimStatus).forEach((status) => {
      stats.claimsByStatus[status] = claims.filter(
        (c) => c.status === status,
      ).length;
    });

    return stats;
  }
  // PASTE THIS TO REPLACE THE BROKEN METHOD AT THE BOTTOM
  async getUserStats(walletAddress: string) {
    // 1. Pending Claims (Using your SUBMITTED status)
    const pendingCount = await this.claimRepository.count({
      where: { 
        userId: walletAddress,        // Correct column name found in your file
        status: ClaimStatus.SUBMITTED // Correct Enum usage
      }
    });

    // 2. Settled Claims (Using APPROVED as "Settled")
    // If you have a 'PAID' or 'SETTLED' status in your Enum, use that instead.
    const settledCount = await this.claimRepository.count({
      where: { 
        userId: walletAddress, 
        status: ClaimStatus.APPROVED 
      }
    });

    return { pendingCount, settledCount };
  }
} // <--- Ensure this is the final closing brace of the class
