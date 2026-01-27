import { Injectable, Logger } from '@nestjs/common';
// FIX: Use ../../ (Two dots) to get to src
import { QueueService } from '../../modules/../modules/queue/queue.service';
import { AuditLogJobData } from '../../modules/../modules/queue/interfaces/audit-log-job.interface';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private queueService: QueueService) {}

  /**
   * Queue an audit log for a claim action
   */
  async logClaimAction(
    userId: string,
    claimId: string,
    action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'SETTLE',
    changes?: Record<string, any>,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const auditData: AuditLogJobData = {
        userId,
        action: `CLAIM_${action}`,
        entity: 'CLAIM',
        entityId: claimId,
        changes,
        metadata: {
          ...metadata,
          source: 'claims-module',
        },
        timestamp: new Date(),
      };

      await this.queueService.addAuditLogJob(auditData);
      this.logger.debug(
        `Audit log queued for claim ${claimId}: ${action} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue audit log for claim ${claimId}`,
        error.stack,
      );
      // Don't throw - audit logging should not block main operations
    }
  }

  /**
   * Queue an audit log for a policy action
   */
  async logPolicyAction(
    userId: string,
    policyId: string,
    action: 'ISSUE' | 'RENEW' | 'CANCEL' | 'EXPIRE',
    changes?: Record<string, any>,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const auditData: AuditLogJobData = {
        userId,
        action: `POLICY_${action}`,
        entity: 'POLICY',
        entityId: policyId,
        changes,
        metadata: {
          ...metadata,
          source: 'policy-module',
        },
        timestamp: new Date(),
      };

      await this.queueService.addAuditLogJob(auditData);
      this.logger.debug(
        `Audit log queued for policy ${policyId}: ${action} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue audit log for policy ${policyId}`,
        error,
      );
      // Don't throw - audit logging should not block main operations
    }
  }

  /**
   * Queue a generic audit log
   */
  async logAction(
    userId: string,
    entity: string,
    entityId: string,
    action: string,
    changes?: Record<string, any>,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const auditData: AuditLogJobData = {
        userId,
        action,
        entity,
        entityId,
        changes,
        metadata,
        timestamp: new Date(),
      };

      await this.queueService.addAuditLogJob(auditData);
      this.logger.debug(
        `Audit log queued for ${entity} ${entityId}: ${action} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue audit log for ${entity} ${entityId}`,
        error,
      );
    }
  }
}
