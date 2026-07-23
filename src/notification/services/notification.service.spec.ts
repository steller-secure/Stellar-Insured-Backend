import { Prisma } from '@prisma/client';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { WebPushService } from './web-push.service';
import { UserService } from '../../user/user.service';
import { PrismaService } from '../../prisma.service';
import { NotificationType } from '../enums/notification-type.enum';

interface MockPrismaService {
  user: {
    findFirst: jest.Mock;
  };
  notification: {
    create: jest.Mock;
  };
  emailOutbox: {
    create: jest.Mock;
  };
  notificationSetting: {
    create: jest.Mock;
  };
}

interface MockEmailService {
  sendEmail: jest.Mock;
}

interface MockWebPushService {
  sendNotification: jest.Mock;
}

interface MockUserService {
  getDecryptedContact: jest.Mock;
}

interface MockQueue {
  add: jest.Mock;
}

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: MockPrismaService;
  let emailService: MockEmailService;
  let webPushService: MockWebPushService;
  let userService: MockUserService;
  let emailQueue: MockQueue;
  let pushQueue: MockQueue;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      emailOutbox: {
        create: jest.fn(),
      },
      notificationSetting: {
        create: jest.fn(),
      },
    };
    emailService = {
      sendEmail: jest.fn(),
    };
    webPushService = {
      sendNotification: jest.fn(),
    };
    userService = {
      getDecryptedContact: jest.fn(),
    };
    emailQueue = { add: jest.fn() };
    pushQueue = { add: jest.fn() };

    service = new NotificationService(
      prisma as unknown as PrismaService,
      emailService as unknown as EmailService,
      webPushService as unknown as WebPushService,
      userService as unknown as UserService,
      emailQueue as unknown as any,
      pushQueue as unknown as any,
    );
  });

  it('persists notification, writes an EmailOutbox row and enqueues jobs (no inline send)', async () => {
    const data: Prisma.InputJsonObject = { policyId: 'policy-1' };
    const pushSubscription = {
      endpoint: 'https://push.example.test/subscription',
      keys: {
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      },
    };

    userService.getDecryptedContact.mockResolvedValue({
      email: 'person@example.com',
      pushSubscription,
      notificationSettings: {
        emailEnabled: true,
        pushEnabled: true,
        notifyContributions: true,
        notifyMilestones: true,
        notifyDeadlines: true,
      },
    });
    prisma.emailOutbox.create.mockResolvedValue({
      id: 'outbox-1',
      to: 'person@example.com',
      subject: 'Contribution received',
      html: '<p>A contribution was received.</p>',
    });

    await service.notify(
      'user-1',
      NotificationType.CONTRIBUTION,
      'Contribution received',
      'A contribution was received.',
      data,
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: NotificationType.CONTRIBUTION,
        title: 'Contribution received',
        message: 'A contribution was received.',
        data,
      },
    });
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(webPushService.sendNotification).not.toHaveBeenCalled();
    expect(prisma.emailOutbox.create).toHaveBeenCalledWith({
      data: {
        to: 'person@example.com',
        subject: 'Contribution received',
        html: '<p>A contribution was received.</p>',
        status: 'PENDING',
      },
    });
    expect(emailQueue.add).toHaveBeenCalledTimes(1);
    expect(pushQueue.add).toHaveBeenCalledWith(
      {
        subscription: pushSubscription,
        payload: {
          title: 'Contribution received',
          body: 'A contribution was received.',
          data,
        },
      },
      expect.objectContaining({ attempts: 5 }),
    );
  });
});
