import { Injectable, Logger } from '@nestjs/common';
import { PolicyAuditEntry, PolicyStateChangeEvent } from '../types/policy-transition.types';
import { PolicyStatus } from '../enums/policy-status.enum';

@Injectable()
export class PolicyAuditService {
  private readonly logger = new Logger(PolicyAuditService.name);
  private auditLog: PolicyAuditEntry[] = [];

  /**
   * Records an audit entry for a policy state change.
   * @param entry - The audit entry to record
   */
  recordAuditEntry(entry: PolicyAuditEntry): void {
    this.auditLog.push(entry);
    this.logger.log(
      `Audit entry recorded for policy ${entry.policyId}: ${entry.fromStatus} -> ${entry.toStatus}`,
    );
  }

  /**
   * Publishes a state change event for subscribers.
   * This can be extended to publish to event bus, message queue, etc.
   * @param event - The state change event
   */
  publishStateChangeEvent(event: PolicyStateChangeEvent): void {
    this.logger.log(
      `State change event published for policy ${event.policyId}: ${event.previousStatus} -> ${event.newStatus}`,
    );
    // TODO: Emit to EventEmitter or publish to event bus
  }

  /**
   * Retrieves audit entries for a specific policy.
   * @param policyId - Policy ID to filter by
   * @returns Array of audit entries for the policy
   */
  getAuditTrail(policyId: string): PolicyAuditEntry[] {
    return this.auditLog.filter((entry) => entry.policyId === policyId);
  }

  /**
   * Retrieves audit entries for a policy within a date range.
   * @param policyId - Policy ID to filter by
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @returns Array of audit entries within the date range
   */
  getAuditTrailByDateRange(
    policyId: string,
    startDate: Date,
    endDate: Date,
  ): PolicyAuditEntry[] {
    return this.getAuditTrail(policyId).filter(
      (entry) => entry.timestamp >= startDate && entry.timestamp <= endDate,
    );
  }

  /**
   * Retrieves audit entries for a policy filtered by status.
   * @param policyId - Policy ID to filter by
   * @param fromStatus - Source status to filter by
   * @returns Array of audit entries with the specified source status
   */
  getAuditTrailByStatus(
    policyId: string,
    fromStatus?: PolicyStatus,
  ): PolicyAuditEntry[] {
    let entries = this.getAuditTrail(policyId);

    if (fromStatus) {
      entries = entries.filter((entry) => entry.fromStatus === fromStatus);
    }

    return entries;
  }

  /**
   * Gets the count of state transitions for a policy.
   * @param policyId - Policy ID
   * @returns Number of transitions
   */
  getTransitionCount(policyId: string): number {
    return this.getAuditTrail(policyId).length;
  }

  /**
   * Gets who transitioned the policy and when.
   * @param policyId - Policy ID
   * @returns Array of transition metadata
   */
  getTransitionHistory(policyId: string): Array<{
    fromStatus: PolicyStatus;
    toStatus: PolicyStatus;
    transitionedBy: string;
    timestamp: Date;
    reason?: string;
  }> {
    return this.getAuditTrail(policyId).map((entry) => ({
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      transitionedBy: entry.transitionedBy,
      timestamp: entry.timestamp,
      reason: entry.reason,
    }));
  }

  /**
   * Verifies audit trail integrity (can be extended with cryptographic verification).
   * @param policyId - Policy ID to verify
   * @returns Boolean indicating if audit trail is valid
   */
  verifyAuditTrailIntegrity(policyId: string): boolean {
    const trail = this.getAuditTrail(policyId);

    // Basic validation: verify chronological order
    for (let i = 1; i < trail.length; i++) {
      if (trail[i].timestamp < trail[i - 1].timestamp) {
        this.logger.warn(
          `Audit trail integrity violation for policy ${policyId}: out of order timestamps`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Clears all audit logs (use with caution - primarily for testing).
   */
  clearAuditLog(): void {
    this.auditLog = [];
    this.logger.warn('All audit logs cleared');
  }
}
