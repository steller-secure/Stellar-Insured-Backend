import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
// FIX 1: Import everything from the central events index (where we added the missing properties)
import { 
  ClaimSubmittedEvent, 
  ClaimApprovedEvent, 
  ClaimRejectedEvent, 
  ClaimSettledEvent, 
  EventNames 
} from '../../events'; 
// FIX 2: Correct path to the service
import { AuditLogService } from '../services/audit-log.service';

/**
 * Listens to claim events and queues audit logs
 */
@Injectable()
export class ClaimAuditLogListener {
  private readonly logger = new Logger(ClaimAuditLogListener.name);

  constructor(private auditLogService: AuditLogService) {}

  @OnEvent(EventNames.CLAIM_SUBMITTED)
  async handleClaimSubmitted(event: ClaimSubmittedEvent): Promise<void> {
    try {
      // FIX 3: Use 'logEvent' directly to match the Service we created
      await this.auditLogService.logEvent({
        userId: event.userId,
        action: 'SUBMIT',
        entity: 'CLAIM',
        entityId: event.claimId,
        changes: { amount: event.claimAmount },
        metadata: { eventType: 'CLAIM_SUBMITTED' },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to log claim submitted event: ${error.message}`,
      );
    }
  }

  @OnEvent(EventNames.CLAIM_APPROVED)
  async handleClaimApproved(event: ClaimApprovedEvent): Promise<void> {
    try {
      await this.auditLogService.logEvent({
        userId: event.approvedBy, // Log the admin who approved it
        action: 'APPROVE',
        entity: 'CLAIM',
        entityId: event.claimId,
        changes: { approvalAmount: event.approvalAmount },
        metadata: { eventType: 'CLAIM_APPROVED' },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to log claim approved event: ${error.message}`,
      );
    }
  }

  @OnEvent(EventNames.CLAIM_REJECTED)
  async handleClaimRejected(event: ClaimRejectedEvent): Promise<void> {
    try {
      await this.auditLogService.logEvent({
        userId: event.rejectedBy, // Log the admin who rejected it
        action: 'REJECT',
        entity: 'CLAIM',
        entityId: event.claimId,
        changes: { rejectionReason: event.rejectionReason },
        metadata: { eventType: 'CLAIM_REJECTED' },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to log claim rejected event: ${error.message}`,
      );
    }
  }

  @OnEvent(EventNames.CLAIM_SETTLED)
  async handleClaimSettled(event: ClaimSettledEvent): Promise<void> {
    try {
      await this.auditLogService.logEvent({
        userId: event.settledBy,
        action: 'SETTLE',
        entity: 'CLAIM',
        entityId: event.claimId,
        changes: { settlementAmount: event.settlementAmount },
        metadata: { eventType: 'CLAIM_SETTLED' },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to log claim settled event: ${error.message}`,
      );
    }
  }
}