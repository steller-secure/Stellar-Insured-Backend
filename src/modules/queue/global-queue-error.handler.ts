import { 
  Processor, 
  OnQueueError, 
  OnQueueFailed, 
  OnQueueCompleted, 
  OnQueueStalled, 
  OnQueueActive 
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull'; // <--- Fixes TS1272 (Import type)

/**
 * Global event handler for queue errors and events
 * Attached to 'audit-log' queue to monitor its lifecycle
 */
@Processor('audit-log') // <--- Must be a Processor to listen to events
export class GlobalQueueErrorHandler {
  private readonly logger = new Logger(GlobalQueueErrorHandler.name);

  @OnQueueError()
  handleError(error: Error): void {
    this.logger.error(
      `Queue error: ${error.message}`,
      error.stack,
    );
  }

  @OnQueueFailed()
  handleFailed(job: Job, err: Error): void {
    this.logger.error(
      `Job ${job.id} (${job.name}) failed after ${job.attemptsMade}/${job.opts.attempts} attempts: ${err.message}`,
      err.stack,
    );
  }

  @OnQueueCompleted()
  handleCompleted(job: Job, result: any): void {
    this.logger.debug(`Job ${job.id} (${job.name}) completed successfully`);
  }

  @OnQueueStalled()
  handleStalled(job: Job): void {
    this.logger.warn(`Job ${job.id} (${job.name}) stalled and will be retried`);
  }

  @OnQueueActive()
  handleActive(job: Job): void {
    this.logger.debug(`Job ${job.id} (${job.name}) is now active`);
  }
}