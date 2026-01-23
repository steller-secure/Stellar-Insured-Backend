import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClaimSubmittedEvent } from '../../events/claim/claim-submitted.event';
import { ClaimApprovedEvent } from '../../events/claim/claim-approved.event';
import { ClaimRejectedEvent } from '../../events/claim/claim-rejected.event';
import { ClaimSettledEvent } from '../../events/claim/claim-settled.event';
import { EventNames } from '../../events/event-names';
import { AuditLogService } from './audit-log.service';

/**
 * Listens to claim events and queues audit logs
 * Demonstrates background processing integration with existing event system
 */
@Injectable()
export class ClaimAuditLogListener {
  private readonly logger = new Logger(ClaimAuditLogListener.name);

  constructor(private auditLogService: AuditLogService) {}

  @OnEvent(EventNames.CLAIM_SUBMITTED)
  async handleClaimSubmitted(event: ClaimSubmittedEvent): Promise<void> {
    try {
      await this.auditLogService.logClaimAction(
        event.userId,
        event.claimId,
        'SUBMIT',
        { amount: event.claimAmount },
        { eventType: 'CLAIM_SUBMITTED' },
      );
    } catch (error) {
      this.logger.error(
        `Failed to log claim submitted event: ${error.message}`,
      );
    }
  }

  @OnEvent(EventNames.CLAIM_APPROVED)
  async handleClaimApproved(event: ClaimApprovedEvent): Promise<void> {
    try {
      await this.auditLogService.logClaimAction(
        event.approvedBy,
        event.claimId,
        'APPROVE',
        { approvalAmount: event.approvalAmount },
        { eventType: 'CLAIM_APPROVED' },
      );
    } catch (error) {
      this.logger.error(
        `Failed to log claim approved event: ${error.message}`,
      );
    }
  }

  @OnEvent(EventNames.CLAIM_REJECTED)
  async handleClaimRejected(event: ClaimRejectedEvent): Promise<void> {
    try {
      await this.auditLogService.logClaimAction(
        event.rejectedBy,
        event.claimId,
        'REJECT',
        { rejectionReason: event.rejectionReason },
        { eventType: 'CLAIM_REJECTED' },
      );
    } catch (error) {
      this.logger.error(
        `Failed to log claim rejected event: ${error.message}`,
      );
    }
  }

  @OnEvent(EventNames.CLAIM_SETTLED)
  async handleClaimSettled(event: ClaimSettledEvent): Promise<void> {
    try {
      await this.auditLogService.logClaimAction(
        event.settledBy,
        event.claimId,
        'SETTLE',
        { settlementAmount: event.settlementAmount },
        { eventType: 'CLAIM_SETTLED' },
      );
    } catch (error) {
      this.logger.error(
        `Failed to log claim settled event: ${error.message}`,
      );
    }
  }
}
