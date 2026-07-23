import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from '../../prisma.service';
import { EmailService } from './email.service';
import { WebPushService } from './web-push.service';
import { NotificationType } from '../enums/notification-type.enum';
import { validateEnum } from '../../common/validators/enum.validator';
import { UserService } from '../../user/user.service';
import {
  QUEUE_NAMES,
  EmailJobData,
  PushJobData,
} from '../constants/queue.constants';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly webPushService: WebPushService,
    private readonly userService: UserService,
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emailQueue: Queue<EmailJobData>,
    @InjectQueue(QUEUE_NAMES.PUSH)
    private readonly pushQueue: Queue<PushJobData>,
  ) {}

  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Prisma.InputJsonValue,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    validateEnum(NotificationType, type, 'NotificationType');

    let contactData;
    try {
      contactData = await this.userService.getDecryptedContact(userId);
    } catch {
      this.logger.warn(`User ${userId} not found for notification`);
      return;
    }

    let settings = contactData.notificationSettings;
    if (!settings) {
      const client = tx ?? this.prisma;
      settings = await client.notificationSetting.create({
        data: { userId },
      });
    }

    if (type === 'CONTRIBUTION' && !settings.notifyContributions) return;
    if (type === 'MILESTONE' && !settings.notifyMilestones) return;
    if (type === 'DEADLINE' && !settings.notifyDeadlines) return;

    const client = tx ?? this.prisma;
    await client.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data,
      },
    });

    if (settings.emailEnabled && contactData.email) {
      await this.enqueueEmail(
        contactData.email,
        title,
        `<p>${message}</p>`,
        tx,
      );
    }

    const pushSubscription = this.getPushSubscription(
      contactData.pushSubscription,
    );
    if (settings.pushEnabled && pushSubscription) {
      await this.pushQueue.add(
        {
          subscription: pushSubscription,
          payload: { title, body: message, data },
        },
        { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
      );
    }
  }

  async enqueueEmail(
    to: string,
    subject: string,
    html: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const outbox = await client.emailOutbox.create({
      data: { to, subject, html, status: 'PENDING' },
    });

    await this.emailQueue.add(
      {
        outboxId: outbox.id,
        to: outbox.to,
        subject: outbox.subject,
        html: outbox.html,
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  private getPushSubscription(
    value: Prisma.JsonValue | null,
  ): webpush.PushSubscription | null {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return this.isPushSubscription(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }

    return this.isPushSubscription(value) ? value : null;
  }

  private isPushSubscription(
    value: unknown,
  ): value is webpush.PushSubscription {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<webpush.PushSubscription>;
    return typeof candidate.endpoint === 'string' && Boolean(candidate.keys);
  }
}
