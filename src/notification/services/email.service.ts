import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import * as sgMail from '@sendgrid/mail';
import { Job } from 'bull';
import { EmailOutboxRepository } from '../../common/repositories/notification.repository';
import {
  QUEUE_NAMES,
  EmailJobData,
} from '../../config/bull.config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { runWithTracingContext } from '../../common/tracing/tracing-context';

import { ConfigService } from '@nestjs/config';
import {
  createCircuitBreaker,
  CircuitBreaker,
} from '../../common/resilience/circuit-breaker';
import { withResilience } from '../../common/resilience/resilience';
import { SENDGRID_POLICY } from '../../common/resilience/resilience.constants';

@Injectable()
@Processor(QUEUE_NAMES.EMAIL)
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly maxAttempts: number;

  /**
   * Circuit breaker + retry for SendGrid. A degraded SendGrid trips the
   * breaker so the Bull worker fails fast and retries the job later (via the
   * job's own backoff) instead of hammering the API.
   */
  private readonly emailBreaker: CircuitBreaker = createCircuitBreaker(
    SENDGRID_POLICY.circuitBreaker.name,
    SENDGRID_POLICY.circuitBreaker,
  );

  constructor(
    private readonly emailOutboxRepository: EmailOutboxRepository,
    private readonly configService: ConfigService,
  ) {
    this.apiKey =
      this.configService.get<string>('notification.sendgrid.apiKey') || '';
    this.fromEmail =
      this.configService.get<string>('notification.sendgrid.fromEmail') ||
      'noreply@novafund.xyz';
    this.maxAttempts = this.configService.get<number>('queue.retryLimits.email', 5);
    if (this.apiKey && typeof (sgMail as any).setApiKey === 'function') {
      (sgMail as any).setApiKey(this.apiKey);
    } else if (this.apiKey && sgMail && (sgMail as any).default && typeof (sgMail as any).default.setApiKey === 'function') {
      (sgMail as any).default.setApiKey(this.apiKey);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  @Process()
  async handleEmailJob(job: Job<EmailJobData>): Promise<void> {
    return runWithTracingContext(
      { correlationId: job.data.correlationId ?? randomUUID() },
      () => this.processEmailJob(job),
    );
  }

  private async processEmailJob(job: Job<EmailJobData>): Promise<void> {
    const { outboxId, to, subject, html } = job.data;

    if (!this.isValidEmail(to)) {
      await this.markFailed(outboxId, `Invalid email address: ${to}`);
      throw new BadRequestException(`Invalid email address: ${to}`);
    }

    if (!this.apiKey) {
      const reason = 'SENDGRID_API_KEY not set. Email not sent.';
      this.logger.warn(reason);
      await this.markFailed(outboxId, reason);
      throw new Error(reason);
    }

    try {
      await withResilience(
        this.emailBreaker,
        () => sgMail.send({ to, from: this.fromEmail, subject, html }),
        { retry: SENDGRID_POLICY.retry },
      );
      await this.emailOutboxRepository.updateStatus(outboxId, {
        status: 'SENT',
        attempts: job.attemptsMade + 1,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${to}: ${message}`);

      const attempts = job.attemptsMade + 1;
      const isFinal = attempts >= this.maxAttempts;
      await this.emailOutboxRepository.updateStatus(outboxId, {
        attempts,
        lastError: message,
        status: isFinal ? 'FAILED' : 'PENDING',
      });

      throw error;
    }
  }

  private async markFailed(outboxId: string, reason: string): Promise<void> {
    await this.emailOutboxRepository.updateStatus(outboxId, {
      status: 'FAILED',
      lastError: reason,
    });
  }
}
