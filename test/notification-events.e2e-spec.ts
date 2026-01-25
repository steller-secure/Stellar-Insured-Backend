import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaimsService } from '../src/modules/claims/claims.service';
import { PolicyService } from '../src/modules/policy/policy.service';
import { PolicyTransitionAction } from '../src/modules/policy/enums/policy-transition-action.enum';
import { DaoService } from '../src/modules/dao/dao.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { ClaimsModule } from '../src/modules/claims/claims.module';
import { PolicyModule } from '../src/modules/policy/policy.module';
import { DaoModule } from '../src/modules/dao/dao.module';
import { NotificationModule } from '../src/modules/notification/notification.module';
import { Notification } from '../src/modules/notification/notification.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

/**
 * Integration tests for the event-driven notification system.
 * Tests verify that business actions emit events and notifications are created in the database.
 */
describe('Notification Events Integration (e2e)', () => {
  let module: TestingModule;
  let claimsService: ClaimsService;
  let policyService: PolicyService;
  let daoService: DaoService;
  let notificationService: NotificationService;
  let notificationRepository: Repository<Notification>;

  // Helpers to generate valid UUIDs for testing
  const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
  const TEST_USER_2_ID = '123e4567-e89b-12d3-a456-426614174001';
  const TEST_CLAIM_ID = '123e4567-e89b-12d3-a456-426614174002';
  const TEST_POLICY_ID = '123e4567-e89b-12d3-a456-426614174003';
  const TEST_PROPOSAL_ID = '123e4567-e89b-12d3-a456-426614174004';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Notification],
          synchronize: true,
        }),
        EventEmitterModule.forRoot(),
        ClaimsModule,
        PolicyModule,
        DaoModule,
        NotificationModule,
      ],
    }).compile();

    // Initialize the app to properly register event listeners
    await module.init();

    claimsService = module.get<ClaimsService>(ClaimsService);
    policyService = module.get<PolicyService>(PolicyService);
    daoService = module.get<DaoService>(DaoService);
    notificationService = module.get<NotificationService>(NotificationService);
    notificationRepository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Clear notifications from database before each test
    await notificationRepository.clear();
  });

  describe('Claim Events', () => {
    it('should create notification when claim is submitted', async () => {
      claimsService.submitClaim(TEST_CLAIM_ID, TEST_USER_ID, TEST_POLICY_ID);

      // Wait a small bit for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const { notifications } = await notificationService.findAllByUserId(
        TEST_USER_ID,
        { page: 1, limit: 10 },
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('claim');
      expect(notifications[0].title).toBe('Claim Submitted');
      expect(notifications[0].message).toContain(TEST_CLAIM_ID);
      expect(notifications[0].isRead).toBe(false);
    });

    it('should create notification when claim is approved', async () => {
      claimsService.approveClaim(TEST_CLAIM_ID, TEST_USER_ID);

      await new Promise(resolve => setTimeout(resolve, 100));

      const { notifications } = await notificationService.findAllByUserId(
        TEST_USER_ID,
        { page: 1, limit: 10 },
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('claim');
      expect(notifications[0].title).toBe('Claim Approved');
      expect(notifications[0].message).toContain('approved');
    });

    it('should create notification when claim is rejected', async () => {
      const reason = 'Insufficient documentation';
      claimsService.rejectClaim(TEST_CLAIM_ID, TEST_USER_ID, reason);

      await new Promise(resolve => setTimeout(resolve, 100));

      const { notifications } = await notificationService.findAllByUserId(
        TEST_USER_ID,
        { page: 1, limit: 10 },
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('claim');
      expect(notifications[0].title).toBe('Claim Rejected');
      expect(notifications[0].message).toContain(reason);
    });

    it('should create notification when claim is settled', async () => {
      const amount = 1500.5;
      claimsService.settleClaim(TEST_CLAIM_ID, TEST_USER_ID, amount);

      await new Promise(resolve => setTimeout(resolve, 100));

      const { notifications } = await notificationService.findAllByUserId(
        TEST_USER_ID,
        { page: 1, limit: 10 },
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('claim');
      expect(notifications[0].title).toBe('Claim Settled');
      expect(notifications[0].message).toContain('1500.50');
    });
  });

  describe('Policy Events', () => {
    it('should create notification when policy is issued', async () => {
      await policyService.transitionPolicy(TEST_POLICY_ID, PolicyTransitionAction.ISSUE, TEST_USER_ID, ['admin']);

      await new Promise(resolve => setTimeout(resolve, 100));

      const { notifications } = await notificationService.findAllByUserId(
        TEST_USER_ID,
        { page: 1, limit: 10 },
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('policy');
      expect(notifications[0].title).toBe('Policy Issued');
      expect(notifications[0].message).toContain(TEST_POLICY_ID);
    });

    it('should create notification when policy is renewed', async () => {
      await policyService.transitionPolicy(TEST_POLICY_ID, PolicyTransitionAction.RENEW, TEST_USER_ID, ['admin']);

      await new Promise(resolve => setTimeout(resolve, 100));

      const { notifications } = await notificationService.findAllByUserId(
        TEST_USER_ID,
        { page: 1, limit: 10 },
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('policy');
      expect(notifications[0].title).toBe('Policy Renewed');
    });

    it('should create notification when policy expires', async () => {
      await policyService.transitionPolicy(TEST_POLICY_ID, PolicyTransitionAction.EXPIRE, TEST_USER_ID, ['admin']);

      await new Promise(resolve => setTimeout(resolve, 100));

      const { notifications } = await notificationService.findAllByUserId(
        TEST_USER_ID,
        { page: 1, limit: 10 },
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('policy');
      expect(notifications[0].title).toBe('Policy Expired');
      expect(notifications[0].message).toContain('renew');
    });

    it('should create notification when policy is cancelled', async () => {
      const reason = 'Non-payment';
      await policyService.transitionPolicy(TEST_POLICY_ID, PolicyTransitionAction.CANCEL, TEST_USER_ID, ['admin'], reason);

      await new Promise(resolve => setTimeout(resolve, 100));

      const { notifications } = await notificationService.findAllByUserId(
        TEST_USER_ID,
        { page: 1, limit: 10 },
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('policy');
      expect(notifications[0].title).toBe('Policy Cancelled');
      expect(notifications[0].message).toContain(reason);
    });
  });

  // describe('DAO Events', () => {
  //   const title = 'Increase Coverage Limit';

  //   it('should create notification when DAO proposal is created', async () => {
  //     daoService.createProposal(TEST_PROPOSAL_ID, TEST_USER_ID, title);

  //     await new Promise(resolve => setTimeout(resolve, 100));

  //     const { notifications } = await notificationService.findAllByUserId(
  //       TEST_USER_ID,
  //       { page: 1, limit: 10 },
  //     );

  //     expect(notifications).toHaveLength(1);
  //     expect(notifications[0].type).toBe('dao');
  //     expect(notifications[0].title).toBe('Proposal Created');
  //     expect(notifications[0].message).toContain(title);
  //   });

  //   it('should create notification when DAO proposal passes', async () => {
  //     daoService.finalizeProposal(TEST_PROPOSAL_ID, TEST_USER_ID, true);

  //     await new Promise(resolve => setTimeout(resolve, 100));

  //     const { notifications } = await notificationService.findAllByUserId(
  //       TEST_USER_ID,
  //       { page: 1, limit: 10 },
  //     );

  //     expect(notifications).toHaveLength(1);
  //     expect(notifications[0].type).toBe('dao');
  //     expect(notifications[0].title).toBe('Proposal Voting Ended');
  //     expect(notifications[0].message).toContain('passed');
  //   });

  //   it('should create notification when DAO proposal does not pass', async () => {
  //     daoService.finalizeProposal(TEST_PROPOSAL_ID, TEST_USER_ID, false);

  //     await new Promise(resolve => setTimeout(resolve, 100));

  //     const { notifications } = await notificationService.findAllByUserId(
  //       TEST_USER_ID,
  //       { page: 1, limit: 10 },
  //     );

  //     expect(notifications).toHaveLength(1);
  //     expect(notifications[0].type).toBe('dao');
  //     expect(notifications[0].title).toBe('Proposal Voting Ended');
  //     expect(notifications[0].message).toContain('did not pass');
  //   });
  // });

  describe('Cross-module isolation', () => {
    it('should not create notifications for other users', async () => {
      const user1 = TEST_USER_ID;
      const user2 = TEST_USER_2_ID;

      claimsService.submitClaim(TEST_CLAIM_ID, user1, TEST_POLICY_ID);
      await policyService.transitionPolicy(TEST_POLICY_ID, PolicyTransitionAction.ISSUE, user2, ['admin']);

      await new Promise(resolve => setTimeout(resolve, 100));

      const { notifications: user1Notifications } =
        await notificationService.findAllByUserId(user1, {
          page: 1,
          limit: 10,
        });
      const { notifications: user2Notifications } =
        await notificationService.findAllByUserId(user2, {
          page: 1,
          limit: 10,
        });

      expect(user1Notifications).toHaveLength(1);
      expect(user1Notifications[0].type).toBe('claim');

      expect(user2Notifications).toHaveLength(1);
      expect(user2Notifications[0].type).toBe('policy');
    });
  });
});
