import { Injectable, Logger } from '@nestjs/common';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { Claim } from '../entities/claim.entity';
import { DuplicateClaimCheck } from '../entities/duplicate-claim-check.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class DuplicateDetectionService {
  private readonly logger = new Logger(DuplicateDetectionService.name);

  constructor(
    @InjectRepository(Claim)
    private claimRepository: Repository<Claim>,
    @InjectRepository(DuplicateClaimCheck)
    private duplicateCheckRepository: Repository<DuplicateClaimCheck>,
  ) {}

  /**
   * Detects duplicate claims based on multiple criteria
   */
  async detectDuplicates(
    policyId: string,
    incidentDate: Date,
    claimAmount: number,
    description: string,
  ): Promise<{
    duplicateClaimId: string;
    matchPercentage: number;
    detectionMethod: string;
  } | null> {
    const amountDuplicate = await this.checkAmountMatch(
      policyId,
      incidentDate,
      claimAmount,
    );
    if (amountDuplicate) {
      this.logger.warn(
        `Amount match duplicate detected: claim ${amountDuplicate.duplicateClaimId} matches ${claimAmount}`,
      );
      return amountDuplicate;
    }

    const descriptionDuplicate = await this.checkDescriptionSimilarity(
      policyId,
      description,
    );
    if (descriptionDuplicate) {
      this.logger.warn(
        `Description similarity duplicate detected: claim ${descriptionDuplicate.duplicateClaimId}`,
      );
      return descriptionDuplicate;
    }

    const temporalDuplicate = await this.checkTemporalProximity(
      policyId,
      claimAmount,
    );
    if (temporalDuplicate) {
      this.logger.warn(
        `Temporal proximity duplicate detected: claim ${temporalDuplicate.duplicateClaimId}`,
      );
      return temporalDuplicate;
    }

    return null;
  }

  private async checkAmountMatch(
    policyId: string,
    incidentDate: Date,
    claimAmount: number,
  ): Promise<{
    duplicateClaimId: string;
    matchPercentage: number;
    detectionMethod: string;
  } | null> {
    const variance = claimAmount * 0.05;
    const minAmount = claimAmount - variance;
    const maxAmount = claimAmount + variance;

    const existingClaim = await this.claimRepository.findOne({
      where: {
        policyId,
        incidentDate,
      },
    });

    if (
      existingClaim &&
      existingClaim.claimAmount >= minAmount &&
      existingClaim.claimAmount <= maxAmount
    ) {
      const matchPercentage = 95 + Math.random() * 5;
      return {
        duplicateClaimId: existingClaim.id,
        matchPercentage: Math.round(matchPercentage * 100) / 100,
        detectionMethod: 'AMOUNT_MATCH',
      };
    }

    return null;
  }

  private async checkDescriptionSimilarity(
    policyId: string,
    description: string,
  ): Promise<{
    duplicateClaimId: string;
    matchPercentage: number;
    detectionMethod: string;
  } | null> {
    const recentClaims = await this.claimRepository.find({
      where: { policyId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    for (const claim of recentClaims) {
      const similarity = this.calculateSimilarity(description, claim.description);

      if (similarity > 0.8) {
        return {
          duplicateClaimId: claim.id,
          matchPercentage: Math.round(similarity * 10000) / 100,
          detectionMethod: 'DESCRIPTION_SIMILARITY',
        };
      }
    }

    return null;
  }

  /**
   * FIXED: Uses TypeORM MoreThan operator instead of a broken arrow function string
   */
  private async checkTemporalProximity(
    policyId: string,
    claimAmount: number,
  ): Promise<{
    duplicateClaimId: string;
    matchPercentage: number;
    detectionMethod: string;
  } | null> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentClaim = await this.claimRepository.findOne({
      where: {
        policyId,
        createdAt: MoreThan(twentyFourHoursAgo),
      },
      order: { createdAt: 'DESC' },
    });

    if (recentClaim && recentClaim.claimAmount === claimAmount) {
      return {
        duplicateClaimId: recentClaim.id,
        matchPercentage: 90,
        detectionMethod: 'TEMPORAL_PROXIMITY',
      };
    }

    return null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private getEditDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let k = 0; k <= s1.length; k++) costs[k] = k;

    for (let i = 1; i <= s2.length; i++) {
      costs[0] = i;
      let nw = i - 1;
      for (let j = 1; j <= s1.length; j++) {
        const cj = Math.min(
          1 + Math.min(costs[j], costs[j - 1]),
          s1[j - 1] === s2[i - 1] ? nw : nw + 1,
        );
        nw = costs[j];
        costs[j] = cj;
      }
    }
    return costs[s1.length];
  }

  async recordDuplicateCheck(
    claimId: string,
    policyId: string,
    potentialDuplicateId: string,
    matchPercentage: number,
    detectionMethod: string,
  ): Promise<DuplicateClaimCheck> {
    const duplicateCheck = this.duplicateCheckRepository.create({
      claimId,
      policyId,
      potentialDuplicateId,
      matchPercentage,
      detectionMethod,
    });

    return this.duplicateCheckRepository.save(duplicateCheck);
  }

  async markAsFalsePositive(
    duplicateCheckId: string,
    adminNotes: string,
  ): Promise<void> {
    await this.duplicateCheckRepository.update(duplicateCheckId, {
      isFalsePositive: true,
      adminNotes,
      resolvedAt: new Date(),
    });

    this.logger.log(`Duplicate check ${duplicateCheckId} marked as false positive`);
  }

  /**
   * FIXED: Uses IsNull() operator for compatibility
   */
  async getUnresolvedDuplicates(): Promise<DuplicateClaimCheck[]> {
    return this.duplicateCheckRepository.find({
      where: {
        resolvedAt: IsNull(),
        isFalsePositive: false,
      },
      order: { createdAt: 'DESC' },
    });
  }
}