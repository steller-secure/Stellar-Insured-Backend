import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PolicyService } from '../policy/policy.service';
import { ClaimsService } from '../claims/claims.service';
import { DaoService } from '../dao/dao.service';
import { NotificationService } from '../notification/notification.service';

describe('DashboardService', () => {
  let service: DashboardService;

  // We create mock data to simulate what the other modules return
  const mockWallet = 'GA5W...EXAMPLE';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PolicyService,
          useValue: { getUserStats: jest.fn().mockResolvedValue({ activeCount: 5, totalValue: 10000 }) },
        },
        {
          provide: ClaimsService,
          useValue: { getUserStats: jest.fn().mockResolvedValue({ pendingCount: 2, settledCount: 1 }) },
        },
        {
          provide: DaoService,
          useValue: { getUserVotingStats: jest.fn().mockResolvedValue({ activeProposals: 10, userVotes: 4 }) },
        },
        {
          provide: NotificationService,
          useValue: { getUnreadCount: jest.fn().mockResolvedValue(3) },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should aggregate all summary data into one response', async () => {
    const result = await service.getSummary(mockWallet);

    // Verify the aggregation logic works
    expect(result.policies.activeCount).toBe(5);
    expect(result.claims.pendingCount).toBe(2);
    expect(result.dao.userVotesCount).toBe(4);
    expect(result.notifications.unreadCount).toBe(3);
    
    // Verify the hardcoded risk pool data we added
    expect(result.riskPool.totalLiquidity).toBe(5000000);
  });
});