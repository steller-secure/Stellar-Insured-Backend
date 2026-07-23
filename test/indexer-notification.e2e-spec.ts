import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { IndexerModule } from '../src/indexer/indexer.module';
import { NotificationModule } from '../src/notification/notification.module';
import { IndexerService } from '../src/indexer/providers/indexer.service';
import { NotificationService } from '../src/notification/providers/notification.service';
import { NotificationType } from '../src/notification/enums/notification-type.enum';

describe('Indexer & Notification Event Flow (E2E)', () => {
  let app: INestApplication;
  let indexerService: IndexerService;
  let notificationService: NotificationService;

  // Mocked state registers simulating database fixtures
  let dbStore: any[] = [];
  let dispatchedNotifications: any[] = [];

  // 1. Setup isolated mock database operations layer matching Prisma expectations
  const mockPrismaService = {
    insurancePolicy: {
      update: jest.fn().mockImplementation(({ where, data }) => {
        const record = { id: where.id, ...data, status: 'ACTIVE' };
        dbStore.push(record);
        return Promise.resolve(record);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve({
          id: where.id,
          userId: 'user-uuid-1234',
          status: 'ACTIVE',
        });
      }),
    },
    notification: {
      create: jest.fn().mockImplementation(({ data }) => {
        dispatchedNotifications.push(data);
        return Promise.resolve({
          id: 'notification-uuid',
          ...data,
          createdAt: new Date(),
        });
      }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IndexerModule, NotificationModule],
    })
      .overrideProvider('PrismaService') // Override with our mock fixture hook
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    indexerService = moduleFixture.get<IndexerService>(IndexerService);
    notificationService =
      moduleFixture.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    // Clear tracking arrays between test iterations
    dbStore = [];
    dispatchedNotifications = [];
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully capture a ledger log, update policy state, and dispatch a POLICY_ACTIVATED notification', async () => {
    // Mocking an incoming on-chain event structure from the blockchain indexer subscription
    const mockLedgerEvent = {
      contractId: '0xStarkNetInsuranceContractAddress',
      eventName: 'PolicyPurchased',
      txHash: '0xabc123xyz789',
      payload: {
        policyId: 'policy-uuid-999',
        premiumPaid: '5000000000000000000', // 5 ETH in wei
        holder: '0xUserWalletAddressString',
      },
    };

    // Act: Simulate the indexer picking up the raw contract log natively
    await indexerService.handleLedgerEvent(mockLedgerEvent);

    // Assert 1: Verify the indexer successfully updated the insurance policy state register inside the DB
    expect(mockPrismaService.insurancePolicy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'policy-uuid-999' },
        data: expect.objectContaining({ isPaid: true }),
      }),
    );
    expect(dbStore.length).toBe(1);

    // Assert 2: Verify the notification module intercepted the lifecycle trigger and dispatched the correct payload
    expect(mockPrismaService.notification.create).toHaveBeenCalled();
    expect(dispatchedNotifications.length).toBe(1);

    const triggeredNotification = dispatchedNotifications[0];
    expect(triggeredNotification.userId).toBe('user-uuid-1234');
    expect(triggeredNotification.type).toBe(NotificationType.POLICY_ACTIVATED);
    expect(triggeredNotification.title).toContain('Policy Activated');
    expect(triggeredNotification.metadata.txHash).toBe('0xabc123xyz789');
  });

  it('should route event drop parameters gracefully when receiving an invalid or unmapped ledger contract event type', async () => {
    const mockInvalidEvent = {
      contractId: '0xUnknownContract',
      eventName: 'SomeUnrecognizedEvent',
      txHash: '0x0000000',
      payload: {},
    };

    // Act
    await indexerService.handleLedgerEvent(mockInvalidEvent);

    // Assert: Database state should remain pristine; notification dispatches should skip execution loops safely
    expect(mockPrismaService.insurancePolicy.update).not.toHaveBeenCalled();
    expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    expect(dbStore.length).toBe(0);
    expect(dispatchedNotifications.length).toBe(0);
  });
});
