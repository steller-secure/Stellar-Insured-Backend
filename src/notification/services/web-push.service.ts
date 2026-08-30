import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import * as webpush from 'web-push';
import { Job } from 'bull';
import { randomUUID } from 'crypto';
import { QUEUE_NAMES, PushJobData } from '../../config/bull.config';
import { ConfigService } from '@nestjs/config';
import { runWithTracingContext } from '../../common/tracing/tracing-context';
import {
  createCircuitBreaker,
  CircuitBreaker,
} from '../../common/resilience/circuit-breaker';
import { withResilience } from '../../common/resilience/resilience';
import { WEB_PUSH_POLICY } from '../../common/resilience/resilience.constants';

export interface WebPushPayload {
  title: string;
  body: string;
  data?: unknown;
}

@Injectable()
@Processor(QUEUE_NAMES.PUSH)
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);

  private readonly publicKey: string;

  /**
   * Circuit breaker + retry for VAPID web-push delivery. Expired subscriptions
   * (410) still stop retrying immediately; other failures trip the breaker so
   * the worker fails fast and lets Bull back off.
   */
  private readonly pushBreaker: CircuitBreaker = createCircuitBreaker(
    WEB_PUSH_POLICY.circuitBreaker.name,
    WEB_PUSH_POLICY.circuitBreaker,
  );

  constructor(private readonly configService: ConfigService) {
    this.publicKey =
      this.configService.get<string>('notification.vapid.publicKey') || '';
    const privateKey =
      this.configService.get<string>('notification.vapid.privateKey') || '';
    const subjectEmail =
      this.configService.get<string>('notification.vapid.subjectEmail') ||
      'admin@novafund.xyz';

    if (this.publicKey && privateKey) {
      try {
        webpush.setVapidDetails(
          `mailto:${subjectEmail}`,
          this.publicKey,
          privateKey,
        );
      } catch (err) {
        this.logger.warn(`Failed to set VAPID details: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      this.logger.warn(
        'VAPID keys not set. Web push notifications will not work.',
      );
    }
  }

  /**
   * Bull processor: sends one queued web-push notification. Throwing on failure
   * lets Bull retry with backoff. Expired subscriptions (HTTP 410) are logged so
   * they can be pruned, but never crash the worker or the calling request.
   */
  @Process()
  async handlePushJob(job: Job<PushJobData>): Promise<void> {
    return runWithTracingContext(
      { correlationId: job.data.correlationId ?? randomUUID() },
      () => this.processPushJob(job),
    );
  }

  private async processPushJob(job: Job<PushJobData>): Promise<void> {
    const { subscription, payload } = job.data;

    if (!this.publicKey) {
      this.logger.warn('VAPID keys not set. Web push notification skipped.');
      return;
    }

    try {
      await withResilience(
        this.pushBreaker,
        () => webpush.sendNotification(subscription, JSON.stringify(payload)),
        {
          retry: {
            ...WEB_PUSH_POLICY.retry,
            // HTTP 410 = subscription no longer valid; never retry those.
            retryIf: error =>
              (error as { statusCode?: number })?.statusCode !== 410,
          },
        },
      );
      this.logger.log(
        `Push notification sent to endpoint: ${subscription.endpoint}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      // HTTP 410 = subscription no longer valid; stop retrying this endpoint.
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 410) {
        this.logger.warn(
          `Web push subscription expired (410) for ${subscription.endpoint}; skipping.`,
        );
        return;
      }
      this.logger.error(`Failed to send push notification: ${message}`);
      throw error;
    }
  }
}
