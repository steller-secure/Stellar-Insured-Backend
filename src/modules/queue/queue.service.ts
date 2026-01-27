import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
// import { InjectQueue } from '@nestjs/bull';
// import { Queue } from 'bull';
import { AuditLogJobData } from './interfaces/audit-log-job.interface';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);

  constructor() {
    this.logger.warn('Redis connection unavailable - audit logs will be processed in-memory (development mode)');
  }

  /**
   * Automatically triggered by NestJS shutdown hooks
   */
  async onModuleDestroy() {
    console.log('Initiating graceful shutdown of queues...');
    try {
      console.log('In-memory mode: No queue connection to close');
    } catch (error) {
      console.error('Error during queue shutdown:', error);
    }
  }

  /**
   * Adds a job to the audit log queue or processes in-memory
   */
  async addAuditLogJob(data: AuditLogJobData) {
    // In-memory processing
    this.logger.debug('Processing audit log in-memory (Redis unavailable):', JSON.stringify(data, null, 2));
    return { id: 'in-memory-job', name: 'audit-log', data };
  }

  /**
   * Get stats for the queue or return default stats
   */
  async getQueueStats() {
    // Default stats for in-memory mode
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };
  }

  /**
   * Drain the queue (in-memory mode is no-op)
   */
  async drainQueues() {
    this.logger.warn('In-memory mode: No queue to drain');
  }

  /**
   * Close the queue (in-memory mode is no-op)
   */
  async closeQueues() {
    this.logger.log('In-memory mode: No queue connection to close');
  }
}
