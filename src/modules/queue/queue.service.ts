import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull'; // Using 'type' fixes TS1272
import { AuditLogJobData } from './interfaces/audit-log-job.interface'; // Ensure path is correct

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue('audit-log') private auditLogQueue: Queue) {}

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