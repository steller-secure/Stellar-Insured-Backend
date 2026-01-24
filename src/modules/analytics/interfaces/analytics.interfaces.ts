export interface DaoStatistics {
  totalProposals: number;
  activeProposals: number;
  passedProposals: number;
  rejectedProposals: number;
  expiredProposals: number;
  draftProposals: number;
  totalVotes: number;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  uniqueVoters: number;
  _placeholder: boolean;
}

export interface PolicyStatistics {
  totalPolicies: number;
  activePolicies: number;
  expiredPolicies: number;
  cancelledPolicies: number;
  totalPremiumCollected: number;
  _placeholder: boolean;
}

export interface ClaimsStatistics {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
  settledClaims: number;
  totalClaimAmount: number;
  totalSettledAmount: number;
  _placeholder: boolean;
}

export interface FraudDetectionStatistics {
  totalFlagged: number;
  confirmedFraud: number;
  falsePositives: number;
  pendingReview: number;
  fraudPreventedAmount: number;
  _placeholder: boolean;
}

export interface AnalyticsOverview {
  dao: DaoStatistics;
  policies: PolicyStatistics;
  claims: ClaimsStatistics;
  fraudDetection: FraudDetectionStatistics;
  periodStart: Date | null;
  periodEnd: Date | null;
  generatedAt: Date;
}

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}
