import { ApiProperty } from '@nestjs/swagger';

export class DaoStatisticsDto {
  @ApiProperty({ description: 'Total number of proposals' })
  totalProposals: number;

  @ApiProperty({ description: 'Number of active proposals' })
  activeProposals: number;

  @ApiProperty({ description: 'Number of passed proposals' })
  passedProposals: number;

  @ApiProperty({ description: 'Number of rejected proposals' })
  rejectedProposals: number;

  @ApiProperty({ description: 'Number of expired proposals' })
  expiredProposals: number;

  @ApiProperty({ description: 'Number of draft proposals' })
  draftProposals: number;

  @ApiProperty({ description: 'Total number of votes cast' })
  totalVotes: number;

  @ApiProperty({ description: 'Number of for votes' })
  forVotes: number;

  @ApiProperty({ description: 'Number of against votes' })
  againstVotes: number;

  @ApiProperty({ description: 'Number of abstain votes' })
  abstainVotes: number;

  @ApiProperty({ description: 'Number of unique voters' })
  uniqueVoters: number;

  @ApiProperty({ description: 'Indicates if this is placeholder data' })
  _placeholder: boolean;
}

export class PolicyStatisticsDto {
  @ApiProperty({ description: 'Total number of policies' })
  totalPolicies: number;

  @ApiProperty({ description: 'Number of active policies' })
  activePolicies: number;

  @ApiProperty({ description: 'Number of expired policies' })
  expiredPolicies: number;

  @ApiProperty({ description: 'Number of cancelled policies' })
  cancelledPolicies: number;

  @ApiProperty({ description: 'Total premium collected' })
  totalPremiumCollected: number;

  @ApiProperty({ description: 'Indicates if this is placeholder data' })
  _placeholder: boolean;
}

export class ClaimsStatisticsDto {
  @ApiProperty({ description: 'Total number of claims' })
  totalClaims: number;

  @ApiProperty({ description: 'Number of pending claims' })
  pendingClaims: number;

  @ApiProperty({ description: 'Number of approved claims' })
  approvedClaims: number;

  @ApiProperty({ description: 'Number of rejected claims' })
  rejectedClaims: number;

  @ApiProperty({ description: 'Number of settled claims' })
  settledClaims: number;

  @ApiProperty({ description: 'Total claim amount' })
  totalClaimAmount: number;

  @ApiProperty({ description: 'Total settled amount' })
  totalSettledAmount: number;

  @ApiProperty({ description: 'Indicates if this is placeholder data' })
  _placeholder: boolean;
}

export class FraudDetectionStatisticsDto {
  @ApiProperty({ description: 'Total flagged cases' })
  totalFlagged: number;

  @ApiProperty({ description: 'Confirmed fraud cases' })
  confirmedFraud: number;

  @ApiProperty({ description: 'False positive cases' })
  falsePositives: number;

  @ApiProperty({ description: 'Cases pending review' })
  pendingReview: number;

  @ApiProperty({ description: 'Amount of fraud prevented' })
  fraudPreventedAmount: number;

  @ApiProperty({ description: 'Indicates if this is placeholder data' })
  _placeholder: boolean;
}

export class AnalyticsOverviewDto {
  @ApiProperty({ type: DaoStatisticsDto, description: 'DAO statistics' })
  dao: DaoStatisticsDto;

  @ApiProperty({ type: PolicyStatisticsDto, description: 'Policy statistics' })
  policies: PolicyStatisticsDto;

  @ApiProperty({ type: ClaimsStatisticsDto, description: 'Claims statistics' })
  claims: ClaimsStatisticsDto;

  @ApiProperty({
    type: FraudDetectionStatisticsDto,
    description: 'Fraud detection statistics',
  })
  fraudDetection: FraudDetectionStatisticsDto;

  @ApiProperty({
    description: 'Start of the analytics period',
    nullable: true,
  })
  periodStart: Date | null;

  @ApiProperty({
    description: 'End of the analytics period',
    nullable: true,
  })
  periodEnd: Date | null;

  @ApiProperty({ description: 'Timestamp when analytics were generated' })
  generatedAt: Date;
}
