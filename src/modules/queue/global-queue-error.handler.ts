import { 
  Processor, 
  OnQueueError, 
  OnQueueFailed, 
  OnQueueCompleted, 
  OnQueueStalled, 
  OnQueueActive 
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

/**
 * Global event handler for queue errors and events
 * Gracefully handles both Redis and in-memory modes
 */
@Processor('audit-log')
export class GlobalQueueErrorHandler {
  private readonly logger = new Logger(GlobalQueueErrorHandler.name);

  @OnQueueError()
  handleError(error: Error): void {
    // Gracefully handle errors in both Redis and in-memory modes
    if (error.message.includes('Redis') || error.message.includes('ECONNREFUSED')) {
      this.logger.warn(`Redis connection error (in-memory mode active): ${error.message}`);
    } else {
      this.logger.error(`Queue error: ${error.message}`, error.stack);
    }
  }

  @OnQueueFailed()
  handleFailed(job: Job, err: Error): void {
    // In development with in-memory queues, don't treat failures as critical
    this.logger.warn(
      `Job ${job.id} (${job.name}) failed after ${job.attemptsMade}/${job.opts.attempts} attempts: ${err.message}`
    );
  }

  @OnQueueCompleted()
  handleCompleted(job: Job, result: any): void {
    this.logger.debug(`Job ${job.id} (${job.name}) completed successfully`);
  }

  @OnQueueStalled()
  handleStalled(job: Job): void {
    // In in-memory mode, stalled jobs are less likely but still possible
    this.logger.warn(`Job ${job.id} (${job.name}) stalled and will be retried`);
  }

  @OnQueueActive()
  handleActive(job: Job): void {
    this.logger.debug(`Job ${job.id} (${job.name}) is now active`);
  }
}
