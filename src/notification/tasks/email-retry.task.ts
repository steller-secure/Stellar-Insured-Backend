import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailOutboxRepository } from '../../common/repositories/notification.repository';
import { QUEUE_NAMES, EMAIL_MAX_ATTEMPTS, EmailJobData } from '../constants/queue.constants';

@Injectable()
export class EmailRetryTask {
  private readonly logger = new Logger(EmailRetryTask.name);

  constructor(
    private readonly emailOutboxRepository: EmailOutboxRepository,
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  /**
   * Sweep the durable outbox for rows that are still PENDING (or previously
   * FAILED) but have not exhausted the attempt budget, and re-enqueue them.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.debug('Sweeping email outbox for pending retries...');

    const pending = await this.emailOutboxRepository.findPendingBatch(50, EMAIL_MAX_ATTEMPTS);

    for (const email of pending) {
      this.logger.log(
        `Re-enqueuing email to ${email.to} (attempt ${email.attempts + 1}/${EMAIL_MAX_ATTEMPTS})`,
      );
      await this.emailQueue.add(
        {
          outboxId: email.id,
          to: email.to,
          subject: email.subject,
          html: email.html,
        },
        {
          attempts: EMAIL_MAX_ATTEMPTS - email.attempts,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }
  }
}
