import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { AuditLogJobData } from './interfaces/audit-log-job.interface';

@Injectable()
export class QueueService implements OnModuleDestroy {
  constructor(
    @InjectQueue('audit-logs') private auditLogsQueue: Queue,
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
   * Add an audit log job to the queue
   */
  async queueAuditLog(data: AuditLogJobData): Promise<void> {
    await this.auditLogsQueue.add(data, {
      jobId: `audit-${data.userId}-${Date.now()}`,
      priority: 10,
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    active: number;
    waiting: number;
    delayed: number;
    failed: number;
    completed: number;
  }> {
    return {
      active: await this.auditLogsQueue.getActiveCount(),
      waiting: await this.auditLogsQueue.getWaitingCount(),
      delayed: await this.auditLogsQueue.getDelayedCount(),
      failed: await this.auditLogsQueue.getFailedCount(),
      completed: await this.auditLogsQueue.getCompletedCount(),
    };
  }

  /**
   * Empty all waiting jobs from the queue
   * FIXED: Bull uses .empty() instead of .drain()
   */
  async drainQueues(): Promise<void> {
    await this.auditLogsQueue.empty();
  }

  /**
   * Close queue connections
   */
  async closeQueues(): Promise<void> {
    await this.auditLogsQueue.close();
  }
}