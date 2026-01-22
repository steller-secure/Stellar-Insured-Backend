import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyAuditEntry } from '../types/policy-transition.types';

export class PolicyEntity {
  id: string;
  policyNumber: string;
  status: PolicyStatus = PolicyStatus.DRAFT;
  customerId: string;
  coverageType: string;
  startDate: Date;
  endDate: Date;
  premium: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  auditTrail: PolicyAuditEntry[] = [];

  constructor(data: Partial<PolicyEntity> = {}) {
    Object.assign(this, data);
  }

  /**
   * Get the current policy status
   */
  getCurrentStatus(): PolicyStatus {
    return this.status;
  }

  /**
   * Get all state transitions recorded in the audit trail
   */
  getAuditTrail(): PolicyAuditEntry[] {
    return this.auditTrail || [];
  }

  /**
   * Add an entry to the audit trail
   */
  addAuditEntry(entry: PolicyAuditEntry): void {
    if (!this.auditTrail) {
      this.auditTrail = [];
    }
    this.auditTrail.push(entry);
  }

  /**
   * Update the policy status and record the transition
   */
  transitionTo(
    newStatus: PolicyStatus,
    auditEntry: PolicyAuditEntry,
  ): void {
    this.status = newStatus;
    this.addAuditEntry(auditEntry);
    this.updatedAt = new Date();
  }
}
