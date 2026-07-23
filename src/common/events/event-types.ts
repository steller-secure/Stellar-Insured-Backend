export enum DomainEventName {
  POLICY_PURCHASED = 'insurance.policy.purchased',
  POLICY_CANCELLED = 'insurance.policy.cancelled',
  POLICY_EXPIRED = 'insurance.policy.expired',
  CLAIM_CREATED = 'insurance.claim.created',
  CLAIM_FRAUD_DETECTED = 'insurance.claim.fraud_detected',
  CLAIM_ORACLE_VERIFIED = 'insurance.claim.oracle_verified',
  CLAIM_APPROVED = 'insurance.claim.approved',
  CLAIM_REJECTED = 'insurance.claim.rejected',
  CLAIM_PAID = 'insurance.claim.paid',
  POOL_CAPITAL_ADDED = 'insurance.pool.capital_added',
  POOL_CAPITAL_LOCKED = 'insurance.pool.capital_locked',
  POOL_CAPITAL_UNLOCKED = 'insurance.pool.capital_unlocked',
  REINSURANCE_CONTRACT_CREATED = 'insurance.reinsurance.contract_created',
  REINSURANCE_CONTRACT_RELEASED = 'insurance.reinsurance.contract_released',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  INDEXER_CONTRIBUTION_MADE = 'indexer.contribution_made',
  INDEXER_MILESTONE_APPROVED = 'indexer.milestone_approved',
  INDEXER_MILESTONE_REJECTED = 'indexer.milestone_rejected',
  INDEXER_DIVIDEND_CLAIMED = 'indexer.dividend_claimed',
  NOTIFICATION_SETTING_UPDATED = 'notification.setting_updated',
}

export interface PolicyPurchasedPayload {
  entityId: string;
  entity: any;
  reason?: string;
}

export interface PolicyCancelledPayload {
  entityId: string;
  beforeState: any;
  afterState: any;
  reason?: string;
}

export interface PolicyExpiredPayload {
  entityId: string;
  beforeState: any;
  afterState: any;
  reason?: string;
}

export interface ClaimCreatedPayload {
  entityId: string;
  entity: any;
}

export interface ClaimFraudDetectedPayload {
  claimId: string;
  userId: string;
  beforeState: any;
  afterState: any;
  reason: string;
}

export interface ClaimOracleVerifiedPayload {
  claimId: string;
  reason: string;
}

export interface ClaimApprovedPayload {
  claimId: string;
  userId: string;
  beforeState: any;
  afterState: any;
  reason?: string;
}

export interface ClaimRejectedPayload {
  claimId: string;
  userId?: string;
  beforeState: any;
  afterState: any;
  reason: string;
}

export interface ClaimPaidPayload {
  claimId: string;
  beforeState: any;
  afterState: any;
  reason?: string;
}

export interface PoolCapitalAddedPayload {
  poolId: string;
  beforeState: any;
  afterState: any;
  reason?: string;
}

export interface PoolCapitalLockedPayload {
  poolId: string;
  beforeState: any;
  afterState: any;
  reason?: string;
}

export interface PoolCapitalUnlockedPayload {
  poolId: string;
  beforeState: any;
  afterState: any;
  reason?: string;
}

export interface ReinsuranceContractCreatedPayload {
  contractId: string;
  entity: any;
  reason?: string;
}

export interface ReinsuranceContractReleasedPayload {
  contractId: string;
  beforeState: any;
  reason?: string;
}

export interface UserUpdatedPayload {
  userId: string;
  beforeState: any;
  afterState: any;
  reason?: string;
}

export interface UserDeletedPayload {
  userId: string;
  beforeState: any;
  afterState: any;
  reason?: string;
}

export interface IndexerContributionMadePayload {
  userId: string;
  projectId: string;
  projectTitle: string;
  amount: any;
  transactionHash: string;
}

export interface IndexerMilestoneApprovedPayload {
  projectId: string;
  projectTitle: string;
  milestoneId: any;
  creatorId?: string;
  investorIds: string[];
}

export interface IndexerMilestoneRejectedPayload {
  projectId: string;
  projectTitle: string;
  milestoneId: any;
  creatorId?: string;
  investorIds: string[];
}

export interface IndexerDividendClaimedPayload {
  userId: string;
  poolId: any;
  amount: any;
}

export interface NotificationSettingUpdatedPayload {
  userId: string;
  settings: any;
  reason?: string;
}

export interface DomainEventPayloadMap {
  [DomainEventName.POLICY_PURCHASED]: PolicyPurchasedPayload;
  [DomainEventName.POLICY_CANCELLED]: PolicyCancelledPayload;
  [DomainEventName.POLICY_EXPIRED]: PolicyExpiredPayload;
  [DomainEventName.CLAIM_CREATED]: ClaimCreatedPayload;
  [DomainEventName.CLAIM_FRAUD_DETECTED]: ClaimFraudDetectedPayload;
  [DomainEventName.CLAIM_ORACLE_VERIFIED]: ClaimOracleVerifiedPayload;
  [DomainEventName.CLAIM_APPROVED]: ClaimApprovedPayload;
  [DomainEventName.CLAIM_REJECTED]: ClaimRejectedPayload;
  [DomainEventName.CLAIM_PAID]: ClaimPaidPayload;
  [DomainEventName.POOL_CAPITAL_ADDED]: PoolCapitalAddedPayload;
  [DomainEventName.POOL_CAPITAL_LOCKED]: PoolCapitalLockedPayload;
  [DomainEventName.POOL_CAPITAL_UNLOCKED]: PoolCapitalUnlockedPayload;
  [DomainEventName.REINSURANCE_CONTRACT_CREATED]: ReinsuranceContractCreatedPayload;
  [DomainEventName.REINSURANCE_CONTRACT_RELEASED]: ReinsuranceContractReleasedPayload;
  [DomainEventName.USER_UPDATED]: UserUpdatedPayload;
  [DomainEventName.USER_DELETED]: UserDeletedPayload;
  [DomainEventName.INDEXER_CONTRIBUTION_MADE]: IndexerContributionMadePayload;
  [DomainEventName.INDEXER_MILESTONE_APPROVED]: IndexerMilestoneApprovedPayload;
  [DomainEventName.INDEXER_MILESTONE_REJECTED]: IndexerMilestoneRejectedPayload;
  [DomainEventName.INDEXER_DIVIDEND_CLAIMED]: IndexerDividendClaimedPayload;
  [DomainEventName.NOTIFICATION_SETTING_UPDATED]: NotificationSettingUpdatedPayload;
}
