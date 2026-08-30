import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import * as webpush from 'web-push';
import { EmailService } from './email.service';
import { WebPushService } from './web-push.service';
import { NotificationType } from '../enums/notification-type.enum';
import { validateEnum } from '../../common/validators/enum.validator';
import { UserService } from '../../user/user.service';
import {
  QUEUE_NAMES,
  EmailJobData,
  PushJobData,
} from '../../config/bull.config';
import {
  NotificationRepository,
  NotificationSettingRepository,
  EmailOutboxRepository,
} from '../../common/repositories/notification.repository';
import { TransactionClient } from '../../common/repositories/repository.interface';
import { getCorrelationId } from '../../common/tracing/tracing-context';
import {
  createCircuitBreaker,
  CircuitBreaker,
} from '../../common/resilience/circuit-breaker';
import { withResilience } from '../../common/resilience/resilience';
import { BULL_QUEUE_POLICY } from '../../common/resilience/resilience.constants';

/**
 * Everything `prepareNotification` produced that still needs to happen after
 * the surrounding database transaction commits. Carries only the data needed
 * to enqueue Bull jobs — never a handle to a DB client.
 */
export interface PreparedNotification {
  email?: {
    outboxId: string;
    to: string;
    subject: string;
    html: string;
  };
  push?: {
    subscription: webpush.PushSubscription;
    payload: PushJobData['payload'];
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * Circuit breaker for Redis-backed Bull enqueues (email + push). When Redis
   * degrades, dispatch fails fast (and stays best-effort) rather than hanging
   * the business operation that already committed — e.g. an insurance purchase
   * or claim assessment that calls this after its transaction commits.
   */
  private readonly queueBreaker: CircuitBreaker = createCircuitBreaker(
    BULL_QUEUE_POLICY.circuitBreaker.name,
    BULL_QUEUE_POLICY.circuitBreaker,
  );

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationSettingRepository: NotificationSettingRepository,
    private readonly emailOutboxRepository: EmailOutboxRepository,
    private readonly emailService: EmailService,
    private readonly webPushService: WebPushService,
    private readonly userService: UserService,
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emailQueue: Queue<EmailJobData>,
    @InjectQueue(QUEUE_NAMES.PUSH)
    private readonly pushQueue: Queue<PushJobData>,
  ) {}

  /**
   * Transactional half of a notification: persists the Notification row and,
   * when email delivery is enabled, the durable EmailOutbox row — both through
   * the supplied `tx` so they commit atomically with the entity they describe.
   *
   * Queue jobs are deliberately NOT added here; call `dispatchPrepared` after
   * the surrounding transaction commits. Bull jobs cannot be rolled back, so
   * enqueuing inside a transaction that later rolls back would notify users
   * about entities that never came into existence.
   *
   * Returns `null` when the user cannot be resolved or their settings opt out.
   */
  async prepareNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Prisma.InputJsonValue,
    tx?: TransactionClient,
  ): Promise<PreparedNotification | null> {
    validateEnum(NotificationType, type, 'NotificationType');

    let contactData;
    try {
      contactData = await this.userService.getDecryptedContact(userId);
    } catch {
      this.logger.warn(`User ${userId} not found for notification`);
      return null;
    }

    let settings = contactData.notificationSettings;
    if (!settings) {
      settings = await this.notificationSettingRepository.upsertForUser(
        userId,
        tx,
      );
    }

    if (type === 'CONTRIBUTION' && !settings.notifyContributions) return null;
    if (type === 'MILESTONE' && !settings.notifyMilestones) return null;
    if (type === 'DEADLINE' && !settings.notifyDeadlines) return null;

    await this.notificationRepository.createNotification(
      { userId, type, title, message, data },
      tx,
    );

    const prepared: PreparedNotification = {};

    if (settings.emailEnabled && contactData.email) {
      const outbox = await this.emailOutboxRepository.createOutbox(
        {
          to: contactData.email,
          subject: title,
          html: `<p>${message}</p>`,
          status: 'PENDING',
        },
        tx,
      );
      prepared.email = {
        outboxId: outbox.id,
        to: outbox.to,
        subject: outbox.subject,
        html: outbox.html,
      };
    }

    const pushSubscription = this.getPushSubscription(
      contactData.pushSubscription,
    );
    if (settings.pushEnabled && pushSubscription) {
      prepared.push = {
        subscription: pushSubscription,
        payload: { title, body: message, data },
      };
    }

    return prepared;
  }

  /**
   * Post-commit half of a notification: enqueues the email (referencing the
   * already-committed outbox row) and/or web-push job. Best-effort by design —
   * a failing queue must never fail the business operation that already
   * committed, and must never flip an idempotency key to FAILED. The durable
   * EmailOutbox row doubles as the retry source for EmailRetryTask.
   */
  async dispatchPrepared(
    prepared: PreparedNotification | PreparedNotification[] | null | undefined,
  ): Promise<void> {
    const items = prepared
      ? Array.isArray(prepared)
        ? prepared
        : [prepared]
      : [];
    for (const item of items) {
      if (item.email) {
        try {
          await withResilience(
            this.queueBreaker,
            async () => {
              await this.emailQueue.add(
                {
                  outboxId: item.email.outboxId,
                  to: item.email.to,
                  subject: item.email.subject,
                  html: item.email.html,
                  correlationId: getCorrelationId(),
                },
                {
                  attempts: 5,
                  backoff: { type: 'exponential', delay: 5000 },
                  removeOnComplete: true,
                  removeOnFail: false,
                },
              );
            },
            {
              retry: BULL_QUEUE_POLICY.retry,
              // Fail fast when Redis is degraded — the durable EmailOutbox row
              // is still picked up by EmailRetryTask later.
              fallback: () => {
                this.logger.error(
                  `Email queue is degraded (circuit open) — outbox ${item.email.outboxId} deferred to EmailRetryTask`,
                );
              },
            },
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to enqueue email for outbox ${item.email.outboxId}: ${message}`,
          );
        }
      }

      if (item.push) {
        try {
          await withResilience(
            this.queueBreaker,
            async () => {
              await this.pushQueue.add(
                {
                  subscription: item.push.subscription,
                  payload: item.push.payload,
                  correlationId: getCorrelationId(),
                },
                { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
              );
            },
            {
              retry: BULL_QUEUE_POLICY.retry,
              fallback: () => {
                this.logger.error(
                  'Push queue is degraded (circuit open) — push notification skipped',
                );
              },
            },
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to enqueue push notification: ${message}`);
        }
      }
    }
  }

  /**
   * Convenience wrapper for callers with no surrounding transaction (indexer
   * event handlers, scheduled tasks, the notification controller): persists
   * the rows and dispatches the jobs immediately.
   */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Prisma.InputJsonValue,
    tx?: TransactionClient,
  ): Promise<void> {
    const prepared = await this.prepareNotification(
      userId,
      type,
      title,
      message,
      data,
      tx,
    );
    await this.dispatchPrepared(prepared);
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
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<webpush.PushSubscription>;
    return typeof candidate.endpoint === 'string' && Boolean(candidate.keys);
  }
}
