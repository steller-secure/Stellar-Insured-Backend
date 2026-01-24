import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLogService } from '../services/audit-log.service';

@Injectable()
export class ClaimAuditLogListener {
  constructor(private readonly auditLogService: AuditLogService) {}

  @OnEvent('claim.submitted')
  async handleClaimSubmitted(event: any) {
    await this.auditLogService.logAction(
      event.userId,
      'CLAIM_SUBMITTED',
      `Claim submitted for policy ${event.policyId}`,
      JSON.stringify({ amount: event.claimAmount || 0 }),
      event.claimId,
    );
  }

  @OnEvent('claim.approved')
  async handleClaimApproved(event: any) {
    await this.auditLogService.logAction(
      event.approvedBy || 'SYSTEM',
      'CLAIM_APPROVED',
      `Claim ${event.claimId} approved`,
      JSON.stringify({ approvalAmount: event.approvalAmount || 0 }),
      event.claimId,
    );
  }

  @OnEvent('claim.rejected')
  async handleClaimRejected(event: any) {
    await this.auditLogService.logAction(
      event.rejectedBy || 'SYSTEM',
      'CLAIM_REJECTED',
      `Claim ${event.claimId} rejected`,
      JSON.stringify({ rejectionReason: event.rejectionReason || 'N/A' }),
      event.claimId,
    );
  }

  @OnEvent('claim.settled')
  async handleClaimSettled(event: any) {
    await this.auditLogService.logAction(
      event.settledBy || 'SYSTEM',
      'CLAIM_SETTLED',
      `Claim ${event.claimId} settled`,
      JSON.stringify({ settlementAmount: event.settlementAmount || 0 }),
      event.claimId,
    );
  }
}