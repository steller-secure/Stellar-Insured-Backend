import { Process, OnGlobalEvent } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

/**
 * Global event handler for queue errors and events
 * Provides centralized error handling and logging for all queue jobs
 */
export class GlobalQueueErrorHandler {
  private readonly logger = new Logger(GlobalQueueErrorHandler.name);

  @OnGlobalEvent('error')
  handleError(error: Error, jobId: string | number): void {
    this.logger.error(
      `Queue error for job ${jobId}: ${error.message}`,
      error.stack,
    );
  }

  @OnGlobalEvent('failed')
  handleFailed(job: Job, err: Error): void {
    this.logger.error(
      `Job ${job.id} (${job.name}) failed after ${job.attemptsMade}/${job.opts.attempts} attempts: ${err.message}`,
      err.stack,
    );
  }

  @OnGlobalEvent('completed')
  handleCompleted(job: Job, result: any): void {
    this.logger.debug(`Job ${job.id} (${job.name}) completed successfully`);
  }

  @OnGlobalEvent('stalled')
  handleStalled(job: Job): void {
    this.logger.warn(`Job ${job.id} (${job.name}) stalled and will be retried`);
  }

  @OnGlobalEvent('active')
  handleActive(job: Job): void {
    this.logger.debug(`Job ${job.id} (${job.name}) is now active`);
  }
}
