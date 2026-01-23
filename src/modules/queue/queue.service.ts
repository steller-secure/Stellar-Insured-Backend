import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AuditLogJobData } from './interfaces/audit-log-job.interface';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('audit-logs') private auditLogsQueue: Queue,
  ) {}

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
   * Drain all queues
   */
  async drainQueues(): Promise<void> {
    await this.auditLogsQueue.drain();
  }

  /**
   * Close queue connections
   */
  async closeQueues(): Promise<void> {
    await this.auditLogsQueue.close();
  }
}
