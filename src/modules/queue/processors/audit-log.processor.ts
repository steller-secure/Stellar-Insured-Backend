import { Process, Processor } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { AuditLogJobData } from '../interfaces/audit-log-job.interface';

@Processor('audit-logs')
export class AuditLogProcessor {
  private readonly logger = new Logger(AuditLogProcessor.name);

  @Process()
  async processAuditLog(job: Job<AuditLogJobData>): Promise<void> {
    try {
      const { userId, action, entity, entityId, changes, metadata, timestamp } =
        job.data;

      this.logger.debug(
        `Processing audit log: User ${userId} performed ${action} on ${entity}:${entityId}`,
      );

      // In-memory processing (Redis disabled)
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

      // Log to console or database directly in dev mode
      console.log('Audit log processed (in-memory):', JSON.stringify(auditEntry, null, 2));
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      this.logger.debug(`Audit log successfully processed for job ${job.id} (in-memory mode)`);
    } catch (error) {
      this.logger.error(`Failed to process audit log: ${error}`, error);
      // Don't throw in stub mode to prevent breaking the application
    }
  }
}