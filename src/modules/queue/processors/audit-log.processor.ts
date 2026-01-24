import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { AuditLogJobData } from '../interfaces/audit-log-job.interface';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
@Processor('audit-logs')
export class AuditLogProcessor {
  private readonly logger = new Logger(AuditLogProcessor.name);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @Process()
  async processAuditLog(job: Job<AuditLogJobData>): Promise<void> {
    try {
      const { userId, action, entity, entityId, changes, metadata, timestamp } =
        job.data;

      this.logger.debug(
        `Processing audit log: User ${userId} performed ${action} on ${entity}:${entityId}`,
      );

      // Simulate audit log processing
      // In production, this would persist to an audit log database or service
      const auditEntry = {
        userId,
        action,
        entity,
        entityId,
        changes: changes || {},
        metadata: {
          ...metadata,
          processedAt: new Date(),
          jobId: job.id,
        },
        timestamp,
      };

      // Log the audit entry (in production, save to database or external service)
      this.logger.log(`Audit log processed: ${JSON.stringify(auditEntry)}`);

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      this.logger.debug(`Audit log successfully processed for job ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to process audit log: ${error}`, error);
      throw error;
    }
  }
}
