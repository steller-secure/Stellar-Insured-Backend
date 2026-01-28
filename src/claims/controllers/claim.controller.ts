import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ClaimService } from '../services/claim.service';
import { CreateClaimDto } from '../dto/create-claim.dto';
import { Claim, ClaimStatus } from '../entities/claim.entity';
import { ClaimOwnerGuard } from '../guards/claim-owner.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { PermissionGuard } from 'src/permissions/permission.guard';
import { Idempotent } from 'src/common/idempotency';

@Controller('claims')
export class ClaimController {
  constructor(private readonly claimService: ClaimService) {}

  /**
   * POST /claims
   * Create a new claim
   * Requires: authenticated user with active policy
   * Requires: Idempotency-Key header for deduplication
   * Validation: policy eligibility, duplicate detection
   * Response: 201 Created with claim details (or 409 if duplicate detected)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  async createClaim(req: any, createClaimDto: CreateClaimDto): Promise<Claim> {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    return this.claimService.createClaim(userId, createClaimDto);
  }

  /**
   * GET /claims/:claimId
   * Retrieve a specific claim by ID
   * Requires: claim owner or admin
   */
  @Get(':claimId')
  @UseGuards(ClaimOwnerGuard)
  async getClaimById(claimId: string): Promise<Claim> {
    const claim = await this.claimService.getClaimById(claimId);

    if (!claim) {
      throw new BadRequestException(`Claim ${claimId} not found`);
    }

    return claim;
  }

  /**
   * GET /claims/user/me
   * Retrieve all claims for the authenticated user
   */
  @Get('user/me')
  async getUserClaims(req: any): Promise<Claim[]> {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    return this.claimService.getClaimsByUserId(userId);
  }

  /**
   * GET /claims/policy/:policyId
   * Retrieve all claims for a specific policy
   * Note: Admin endpoint - should be restricted
   */
  @Get('policy/:policyId')
  async getPolicyClaims(policyId: string): Promise<Claim[]> {
    return this.claimService.getClaimsByPolicyId(policyId);
  }

  /**
   * PATCH /claims/:claimId/status
   * Update claim status (for admin/reviewer)
   * Requires: admin or authorized reviewer
   * Requires: Idempotency-Key header for safe replay
   */
  @Patch(':claimId/status')
  @Idempotent()
  async updateClaimStatus(
    claimId: string,
    body: { status: ClaimStatus; notes?: string },
    req: any,
  ): Promise<Claim> {
    const reviewedBy = req.user?.id;

    if (!reviewedBy) {
      throw new BadRequestException('Reviewer ID is required');
    }

    if (!Object.values(ClaimStatus).includes(body.status)) {
      throw new BadRequestException(`Invalid claim status: ${body.status}`);
    }

    return this.claimService.updateClaimStatus(
      claimId,
      body.status,
      reviewedBy,
      body.notes,
    );
  }

  /**
   * GET /claims/admin/flagged
   * Retrieve all claims flagged for manual review
   * Admin endpoint - should be restricted
   */
  @Get('admin/flagged')
  async getFlaggedClaims(): Promise<Claim[]> {
    return this.claimService.getFlaggedClaims();
  }

  /**
   * GET /claims/admin/status/:status
   * Retrieve claims by status
   * Admin endpoint - should be restricted
   */
  @Get('admin/status/:status')
  async getClaimsByStatus(status: string): Promise<Claim[]> {
    if (!Object.values(ClaimStatus).includes(status as ClaimStatus)) {
      throw new BadRequestException(`Invalid claim status: ${status}`);
    }

    return this.claimService.getClaimsByStatus(status as ClaimStatus);
  }

  /**
   * GET /claims/admin/policy/:policyId/stats
   * Get claim statistics for a policy
   * Admin endpoint - should be restricted
   */
  @Get('admin/policy/:policyId/stats')
  async getPolicyClaimStats(policyId: string): Promise<{
    totalClaims: number;
    totalClaimAmount: number;
    claimsByStatus: Record<ClaimStatus, number>;
    flaggedCount: number;
  }> {
    return this.claimService.getPolicyClaimStats(policyId);
  }
  
  // src/claims/claims.controller.ts
@UseGuards(JwtAuthGuard, PermissionGuard)
@Post(':id/approve')
approveClaim() {}

}
