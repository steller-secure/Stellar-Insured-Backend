import { OnQueueActive, OnQueueCompleted, OnQueueFailed, OnQueueStalled, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

@Processor('audit-logs')
export class GlobalQueueErrorHandler {
  private readonly logger = new Logger(GlobalQueueErrorHandler.name);

  @OnQueueFailed()
  handleFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${err.message}`);
  }

  @OnQueueCompleted()
  handleCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnQueueStalled()
  handleStalled(job: Job) {
    this.logger.warn(`Job ${job.id} has stalled`);
  }

  @OnQueueActive()
  handleActive(job: Job) {
    this.logger.log(`Job ${job.id} is now active`);
  }
}