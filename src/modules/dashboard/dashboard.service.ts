import { Injectable } from '@nestjs/common';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { PolicyService } from '../policy/policy.service';
import { ClaimsService } from '../claims/claims.service';
// FIX: Import DaoService from the correct file location
import { DaoService } from '../dao/dao.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly policyService: PolicyService,
    private readonly claimsService: ClaimsService,
    // FIX: Inject DaoService instead of ProposalService
    private readonly daoService: DaoService,
    private readonly notificationService: NotificationService,
  ) {}

  async getSummary(walletAddress: string): Promise<DashboardSummaryDto> {
    const [policies, claims, daoStats, unreadNotifications] = await Promise.all([
      this.policyService.getUserStats(walletAddress),
      this.claimsService.getUserStats(walletAddress),
      // FIX: Call the method on daoService
      this.daoService.getUserVotingStats(walletAddress),
      this.notificationService.getUnreadCount(walletAddress),
    ]);

    const riskPoolData = {
      totalLiquidity: 5000000, 
      utilizationRate: 12.5,
    };

    return {
      policies: {
        activeCount: policies.activeCount,
        totalCoverageValue: policies.totalValue,
      },
      claims: {
        pendingCount: claims.pendingCount,
        settledCount: claims.settledCount,
      },
      dao: {
        activeProposals: daoStats.activeProposals,
        userVotesCount: daoStats.userVotes,
      },
      notifications: {
        unreadCount: unreadNotifications,
      },
      riskPool: riskPoolData,
    };
  }
}