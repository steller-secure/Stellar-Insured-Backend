export class DashboardSummaryDto {
  policies: {
    activeCount: number;
    totalCoverageValue: number;
  };
  claims: {
    pendingCount: number;
    settledCount: number;
  };
  dao: {
    activeProposals: number;
    userVotesCount: number;
  };
  notifications: {
    unreadCount: number;
  };
  riskPool: {
    totalLiquidity: number;
    utilizationRate: number;
  };
}