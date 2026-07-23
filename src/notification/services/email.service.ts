import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import * as sgMail from '@sendgrid/mail';
import { Job } from 'bull';
import { PrismaService } from '../../prisma.service';
import {
  QUEUE_NAMES,
  EMAIL_MAX_ATTEMPTS,
  EmailJobData,
} from '../constants/queue.constants';

import { ConfigService } from '@nestjs/config';

@Injectable()
@Processor(QUEUE_NAMES.EMAIL)
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey =
      this.configService.get<string>('notification.sendgrid.apiKey') || '';
    this.fromEmail =
      this.configService.get<string>('notification.sendgrid.fromEmail') ||
      'noreply@novafund.xyz';
    sgMail.setApiKey(this.apiKey);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Bull processor: sends one queued email and transitions the durable
   * EmailOutbox row PENDING → SENT (success) or FAILED (max attempts reached).
   *
   * A failed SendGrid call throws so Bull retries with exponential backoff
   * (bounded by `attempts`). On the final failure we mark the row FAILED.
   * Bounded by {@link EMAIL_MAX_ATTEMPTS} at the row level as well so a worker
   * never loops endlessly.
   */
  @Process()
  async handleEmailJob(job: Job<EmailJobData>): Promise<void> {
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
      const msg = {
        to,
        from: this.fromEmail,
        subject,
        html,
      };

      await sgMail.send(msg);
      await this.prisma.emailOutbox.update({
        where: { id: outboxId },
        data: { status: 'SENT', attempts: job.attemptsMade + 1 },
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${to}: ${message}`);

      const attempts = job.attemptsMade + 1;
      const isFinal = attempts >= EMAIL_MAX_ATTEMPTS;
      await this.prisma.emailOutbox.update({
        where: { id: outboxId },
        data: {
          attempts,
          lastError: message,
          status: isFinal ? 'FAILED' : 'PENDING',
        },
      });

      // Re-throw so Bull honours its own attempt/backoff schedule.
      throw error;
    }
  }

  private async markFailed(outboxId: string, reason: string): Promise<void> {
    await this.prisma.emailOutbox.update({
      where: { id: outboxId },
      data: { status: 'FAILED', lastError: reason },
    });
  }
}
