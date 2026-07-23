import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from '../../../insurance/services/audit.service';
import { AuditAction } from '../../../insurance/enums/audit-action.enum';
import { DomainEvent } from '../domain-event.interface';
import {
  DomainEventName,
  PolicyPurchasedPayload,
  PolicyCancelledPayload,
  PolicyExpiredPayload,
  ClaimCreatedPayload,
  ClaimFraudDetectedPayload,
  ClaimOracleVerifiedPayload,
  ClaimApprovedPayload,
  ClaimRejectedPayload,
  ClaimPaidPayload,
  PoolCapitalAddedPayload,
  PoolCapitalLockedPayload,
  PoolCapitalUnlockedPayload,
  ReinsuranceContractCreatedPayload,
  ReinsuranceContractReleasedPayload,
  UserUpdatedPayload,
  UserDeletedPayload,
  NotificationSettingUpdatedPayload,
} from '../event-types';

@Injectable()
export class AuditEventListener {
  private readonly logger = new Logger(AuditEventListener.name);

  constructor(private readonly auditService: AuditService) {}

  @OnEvent(DomainEventName.POLICY_PURCHASED)
  async handlePolicyPurchased(
    event: DomainEvent<
      DomainEventName.POLICY_PURCHASED,
      PolicyPurchasedPayload
    >,
  ) {
    await this.auditService.logPurchase(
      'InsurancePolicy',
      event.payload.entityId,
      event.payload.entity,
      undefined,
      event.payload.reason ?? 'Policy purchased',
    );
  }

  @OnEvent(DomainEventName.POLICY_CANCELLED)
  async handlePolicyCancelled(
    event: DomainEvent<
      DomainEventName.POLICY_CANCELLED,
      PolicyCancelledPayload
    >,
  ) {
    await this.auditService.logUpdate(
      'InsurancePolicy',
      event.payload.entityId,
      event.payload.beforeState,
      event.payload.afterState,
      undefined,
      event.payload.reason ?? 'Policy cancelled',
    );
  }

  @OnEvent(DomainEventName.POLICY_EXPIRED)
  async handlePolicyExpired(
    event: DomainEvent<DomainEventName.POLICY_EXPIRED, PolicyExpiredPayload>,
  ) {
    await this.auditService.logUpdate(
      'InsurancePolicy',
      event.payload.entityId,
      event.payload.beforeState,
      event.payload.afterState,
      undefined,
      event.payload.reason ?? 'Policy expired',
    );
  }

  @OnEvent(DomainEventName.CLAIM_CREATED)
  async handleClaimCreated(
    event: DomainEvent<DomainEventName.CLAIM_CREATED, ClaimCreatedPayload>,
  ) {
    await this.auditService.logCreate(
      'Claim',
      event.payload.entityId,
      event.payload.entity,
    );
  }

  @OnEvent(DomainEventName.CLAIM_FRAUD_DETECTED)
  async handleClaimFraudDetected(
    event: DomainEvent<
      DomainEventName.CLAIM_FRAUD_DETECTED,
      ClaimFraudDetectedPayload
    >,
  ) {
    await this.auditService.log(
      AuditAction.FRAUD_DETECTED,
      'Claim',
      event.payload.claimId,
      event.payload.beforeState,
      event.payload.afterState,
      undefined,
      event.payload.reason,
    );
  }

  @OnEvent(DomainEventName.CLAIM_ORACLE_VERIFIED)
  async handleClaimOracleVerified(
    event: DomainEvent<
      DomainEventName.CLAIM_ORACLE_VERIFIED,
      ClaimOracleVerifiedPayload
    >,
  ) {
    await this.auditService.log(
      AuditAction.ORACLE_VERIFIED,
      'Claim',
      event.payload.claimId,
      undefined,
      undefined,
      undefined,
      event.payload.reason,
    );
  }

  @OnEvent(DomainEventName.CLAIM_APPROVED)
  async handleClaimApproved(
    event: DomainEvent<DomainEventName.CLAIM_APPROVED, ClaimApprovedPayload>,
  ) {
    await this.auditService.logApprove(
      'Claim',
      event.payload.claimId,
      event.payload.beforeState,
      event.payload.afterState,
      undefined,
      event.payload.reason,
    );
  }

  @OnEvent(DomainEventName.CLAIM_REJECTED)
  async handleClaimRejected(
    event: DomainEvent<DomainEventName.CLAIM_REJECTED, ClaimRejectedPayload>,
  ) {
    await this.auditService.logReject(
      'Claim',
      event.payload.claimId,
      event.payload.beforeState,
      event.payload.afterState,
      event.payload.reason,
    );
  }

  @OnEvent(DomainEventName.CLAIM_PAID)
  async handleClaimPaid(
    event: DomainEvent<DomainEventName.CLAIM_PAID, ClaimPaidPayload>,
  ) {
    await this.auditService.logPayout(
      'Claim',
      event.payload.claimId,
      event.payload.beforeState,
      event.payload.afterState,
    );
  }

  @OnEvent(DomainEventName.POOL_CAPITAL_ADDED)
  async handlePoolCapitalAdded(
    event: DomainEvent<
      DomainEventName.POOL_CAPITAL_ADDED,
      PoolCapitalAddedPayload
    >,
  ) {
    await this.auditService.logAddCapital(
      'InsurancePool',
      event.payload.poolId,
      event.payload.beforeState,
      event.payload.afterState,
    );
  }

  @OnEvent(DomainEventName.POOL_CAPITAL_LOCKED)
  async handlePoolCapitalLocked(
    event: DomainEvent<
      DomainEventName.POOL_CAPITAL_LOCKED,
      PoolCapitalLockedPayload
    >,
  ) {
    await this.auditService.logUpdate(
      'InsurancePool',
      event.payload.poolId,
      event.payload.beforeState,
      event.payload.afterState,
    );
  }

  @OnEvent(DomainEventName.POOL_CAPITAL_UNLOCKED)
  async handlePoolCapitalUnlocked(
    event: DomainEvent<
      DomainEventName.POOL_CAPITAL_UNLOCKED,
      PoolCapitalUnlockedPayload
    >,
  ) {
    await this.auditService.logUnlockCapital(
      'InsurancePool',
      event.payload.poolId,
      event.payload.beforeState,
      event.payload.afterState,
    );
  }

  @OnEvent(DomainEventName.REINSURANCE_CONTRACT_CREATED)
  async handleReinsuranceContractCreated(
    event: DomainEvent<
      DomainEventName.REINSURANCE_CONTRACT_CREATED,
      ReinsuranceContractCreatedPayload
    >,
  ) {
    await this.auditService.logCreate(
      'ReinsuranceContract',
      event.payload.contractId,
      event.payload.entity,
    );
  }

  @OnEvent(DomainEventName.REINSURANCE_CONTRACT_RELEASED)
  async handleReinsuranceContractReleased(
    event: DomainEvent<
      DomainEventName.REINSURANCE_CONTRACT_RELEASED,
      ReinsuranceContractReleasedPayload
    >,
  ) {
    await this.auditService.logDelete(
      'ReinsuranceContract',
      event.payload.contractId,
      event.payload.beforeState,
      undefined,
      event.payload.reason ?? 'Reinsurance contract released',
    );
  }

  @OnEvent(DomainEventName.USER_UPDATED)
  async handleUserUpdated(
    event: DomainEvent<DomainEventName.USER_UPDATED, UserUpdatedPayload>,
  ) {
    await this.auditService.log(
      AuditAction.UPDATE,
      'User',
      event.payload.userId,
      event.payload.beforeState,
      event.payload.afterState,
      undefined,
      event.payload.reason ?? 'Profile updated',
    );
  }

  @OnEvent(DomainEventName.USER_DELETED)
  async handleUserDeleted(
    event: DomainEvent<DomainEventName.USER_DELETED, UserDeletedPayload>,
  ) {
    await this.auditService.log(
      AuditAction.DELETE,
      'User',
      event.payload.userId,
      event.payload.beforeState,
      event.payload.afterState,
      undefined,
      event.payload.reason ?? 'User soft-deleted',
    );
  }

  @OnEvent(DomainEventName.NOTIFICATION_SETTING_UPDATED)
  async handleNotificationSettingUpdated(
    event: DomainEvent<
      DomainEventName.NOTIFICATION_SETTING_UPDATED,
      NotificationSettingUpdatedPayload
    >,
  ) {
    await this.auditService.log(
      AuditAction.UPDATE,
      'NotificationSetting',
      event.payload.userId,
      undefined,
      event.payload.settings,
      undefined,
      event.payload.reason ?? 'Notification settings updated',
    );
  }
}
