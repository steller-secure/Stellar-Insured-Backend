import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type type { Queue } from 'bull'; // Using 'type' fixes TS1272
import { AuditLogJobData } from './interfaces/audit-log-job.interface'; // Ensure path is correct

@Injectable()
export class QueueService implements OnModuleDestroy {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    @InjectQueue('audit-logs')
    private readonly auditLogsQueue: Queue<AuditLogJobData>,
  ) {}

  /**
   * Automatically triggered by NestJS shutdown hooks
   */
  async onModuleDestroy() {
    /* eslint-disable no-console */
    console.log('Initiating graceful shutdown of queues...');
    try {
      await this.closeQueues();
      console.log('Queues gracefully shut down');
    } catch (error) {
      console.error('Error during queue shutdown:', error);
    }
    /* eslint-enable no-console */
  }

  /**
   * Adds a job to the audit log queue
   */
  async addAuditLogJob(data: AuditLogJobData) {
    return this.auditLogQueue.add(data);
  }

  /**
   * Get stats for the queue (Fixes health.service.ts and queue.controller.ts)
   */
  async getQueueStats() {
    return {
      waiting: await this.auditLogQueue.getWaitingCount(),
      active: await this.auditLogQueue.getActiveCount(),
      completed: await this.auditLogQueue.getCompletedCount(),
      failed: await this.auditLogQueue.getFailedCount(),
      delayed: await this.auditLogQueue.getDelayedCount(),
    };
  }

  /**
   * Drain the queue (Fixes main.ts)
   */
  async drainQueues() {
    this.logger.warn('Draining audit log queue...');
    await this.auditLogQueue.empty();
  }

  /**
   * Close the queue (Fixes main.ts)
   */
  async closeQueues() {
    this.logger.log('Closing audit log queue connection...');
    await this.auditLogQueue.close();
  }
}
