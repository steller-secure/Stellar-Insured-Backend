/**
 * Contract event types from Soroban smart contracts
 * Matches the event symbols defined in contracts/shared/src/events.rs
 */

export enum ContractEventType {
  // Project events
  PROJECT_CREATED = 'proj_new',
  PROJECT_FUNDED = 'proj_fund',
  PROJECT_COMPLETED = 'proj_done',
  PROJECT_FAILED = 'proj_fail',

  // Contribution events
  CONTRIBUTION_MADE = 'contrib',
  REFUND_ISSUED = 'refund',

  // Escrow events
  ESCROW_INITIALIZED = 'esc_init',
  FUNDS_LOCKED = 'lock',
  FUNDS_RELEASED = 'release',
  MILESTONE_CREATED = 'm_create',
  MILESTONE_SUBMITTED = 'm_submit',
  MILESTONE_APPROVED = 'm_apprv',
  MILESTONE_REJECTED = 'm_reject',
  MILESTONE_COMPLETED = 'milestone',
  VALIDATORS_UPDATED = 'v_update',

  // Distribution events
  PROFIT_DISTRIBUTED = 'profit',
  DIVIDEND_CLAIMED = 'claim',

  // Governance events
  PROPOSAL_CREATED = 'proposal',
  VOTE_CAST = 'vote',
  PROPOSAL_EXECUTED = 'execute',

  // Reputation events
  USER_REGISTERED = 'user_reg',
  REPUTATION_UPDATED = 'rep_up',
  BADGE_EARNED = 'badge',

  // Multi-party payment events
  PAYMENT_SETUP = 'pay_setup',
  PAYMENT_RECEIVED = 'pay_recv',
  PAYMENT_WITHDRAWN = 'pay_withd',

  // Subscription events
  SUBSCRIPTION_CREATED = 'subscr',
  SUBSCRIPTION_CANCELLED = 'sub_cancl',
  SUBSCRIPTION_MODIFIED = 'sub_mod',
  SUBSCRIPTION_PAUSED = 'sub_pause',
  SUBSCRIPTION_RESUMED = 'sub_resum',
  PAYMENT_FAILED = 'pay_fail',
  SUBSCRIPTION_PAYMENT = 'deposit',

  // Cross-chain bridge events
  BRIDGE_INITIALIZED = 'br_init',
  SUPPORTED_CHAIN_ADDED = 'chain_add',
  SUPPORTED_CHAIN_REMOVED = 'chain_rem',
  ASSET_WRAPPED = 'wrap',
  ASSET_UNWRAPPED = 'unwrap',
  BRIDGE_DEPOSIT = 'br_dep',
  BRIDGE_WITHDRAW = 'br_wdraw',
  BRIDGE_PAUSED = 'br_pause',
  BRIDGE_UNPAUSED = 'br_res',
  RELAYER_ADDED = 'rel_add',
  RELAYER_REMOVED = 'rel_rem',
  BRIDGE_TX_CONFIRMED = 'tx_conf',
  BRIDGE_TX_FAILED = 'tx_fail',

  // Contract lifecycle events
  CONTRACT_PAUSED = 'esc_pause',
  CONTRACT_RESUMED = 'esc_resum',
  UPGRADE_SCHEDULED = 'upg_sched',
  UPGRADE_EXECUTED = 'upg_exec',
  UPGRADE_CANCELLED = 'upg_canc',
}

/**
 * Raw event data from Stellar RPC
 */
export interface SorobanEvent {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: string[];
  value: string;
  inSuccessfulContractCall: boolean;
  txHash: string;
}

/**
 * Parsed contract event with structured data
 *
 * `data` holds decoded, typed on-chain fields (NOT raw XDR). When decoding
 * fails the payload is quarantined: `data` still carries a `_quarantined`
 * marker (see XdrDecoderService) and `quarantined` is set so handlers and
 * persistence can skip it gracefully.
 */
export interface ParsedContractEvent {
  eventId: string;
  ledgerSeq: number;
  ledgerClosedAt: Date;
  contractId: string;
  eventType: ContractEventType;
  transactionHash: string;
  data: DecodedEventData;
  quarantined: boolean;
  inSuccessfulContractCall: boolean;
}

/**
 * Decoded event payload. May be a known structured shape (one of the
 * `*Event` interfaces below) or, on decode failure, a quarantine marker.
 */
export type DecodedEventData = Record<string, unknown> &
  Partial<QuarantineMarker>;

/**
 * Marker attached to payloads that could not be decoded. These are persisted
 * to the quarantine table rather than the domain tables.
 */
export interface QuarantineMarker {
  _quarantined: true;
  _quarantineReason: string;
  rawXdr: string;
}

/**
 * Project created event data
 */
export interface ProjectCreatedEvent {
  projectId: number;
  creator: string;
  fundingGoal: string;
  deadline: number;
  token: string;
}

/**
 * Project funded event data
 */
export interface ProjectFundedEvent {
  projectId: number;
  amount: string;
  totalRaised: string;
}

/**
 * Contribution made event data
 */
export interface ContributionMadeEvent {
  projectId: number;
  contributor: string;
  amount: string;
  totalRaised: string;
}

/**
 * Refund issued event data
 */
export interface RefundIssuedEvent {
  projectId: number;
  contributor: string;
  amount: string;
}

/**
 * Escrow initialized event data
 */
export interface EscrowInitializedEvent {
  projectId: number;
  escrowId: string;
  totalAmount: string;
}

/**
 * Funds locked event data
 */
export interface FundsLockedEvent {
  projectId: number;
  milestoneId: number;
  amount: string;
}

/**
 * Funds released event data
 */
export interface FundsReleasedEvent {
  projectId: number;
  milestoneId: number;
  amount: string;
}

/**
 * Milestone created event data
 */
export interface MilestoneCreatedEvent {
  projectId: number;
  milestoneId: number;
  fundingAmount: string;
}

/**
 * Milestone submitted event data
 */
export interface MilestoneSubmittedEvent {
  projectId: number;
  milestoneId: number;
  submitter: string;
}

/**
 * Milestone approved event data
 */
export interface MilestoneApprovedEvent {
  projectId: number;
  milestoneId: number;
  approvalCount: number;
}

/**
 * Milestone rejected event data
 */
export interface MilestoneRejectedEvent {
  projectId: number;
  milestoneId: number;
  rejectionCount: number;
}

/**
 * Milestone completed event data
 */
export interface MilestoneCompletedEvent {
  projectId: number;
  milestoneId: number;
}

/**
 * Validators updated event data
 */
export interface ValidatorsUpdatedEvent {
  projectId: number;
  validatorCount: number;
}

/**
 * Profit distributed event data
 */
export interface ProfitDistributedEvent {
  poolId: string;
  totalProfit: string;
  perShare: string;
}

/**
 * Dividend claimed event data
 */
export interface DividendClaimedEvent {
  poolId: string;
  claimer: string;
  amount: string;
}

/**
 * Proposal created event data
 */
export interface ProposalCreatedEvent {
  proposalId: number;
  proposer: string;
  title: string;
}

/**
 * Vote cast event data
 */
export interface VoteCastEvent {
  proposalId: number;
  voter: string;
  support: string;
}

/**
 * Proposal executed event data
 */
export interface ProposalExecutedEvent {
  proposalId: number;
  success: boolean;
}

/**
 * User registered event data
 */
export interface UserRegisteredEvent {
  user: string;
}

/**
 * Reputation updated event data
 */
export interface ReputationUpdatedEvent {
  user: string;
  score: number;
  delta: number;
}

/**
 * Badge earned event data
 */
export interface BadgeEarnedEvent {
  user: string;
  badge: string;
}

/**
 * Payment setup event data
 */
export interface PaymentSetupEvent {
  paymentId: string;
  payer: string;
  payee: string;
}

/**
 * Payment received event data
 */
export interface PaymentReceivedEvent {
  paymentId: string;
  amount: string;
}

/**
 * Payment withdrawn event data
 */
export interface PaymentWithdrawnEvent {
  paymentId: string;
  recipient: string;
  amount: string;
}

/**
 * Subscription created event data
 */
export interface SubscriptionCreatedEvent {
  subscriptionId: string;
  subscriber: string;
  plan: string;
  amount: string;
}

/**
 * Subscription status event data
 */
export interface SubscriptionStatusEvent {
  subscriptionId: string;
  status: string;
}

/**
 * Subscription modified event data
 */
export interface SubscriptionModifiedEvent {
  subscriptionId: string;
  plan: string;
  amount: string;
}

/**
 * Payment failed event data
 */
export interface PaymentFailedEvent {
  subscriptionId: string;
  reason: string;
}

/**
 * Subscription payment event data
 */
export interface SubscriptionPaymentEvent {
  subscriptionId: string;
  amount: string;
}

/**
 * Bridge initialized event data
 */
export interface BridgeInitializedEvent {
  bridgeId: string;
  admin: string;
}

/**
 * Supported chain added event data
 */
export interface SupportedChainAddedEvent {
  chainId: number;
  chainName: string;
}

/**
 * Supported chain removed event data
 */
export interface SupportedChainRemovedEvent {
  chainId: number;
}

/**
 * Asset wrapped event data
 */
export interface AssetWrappedEvent {
  asset: string;
  wrappedAsset: string;
  amount: string;
}

/**
 * Asset unwrapped event data
 */
export interface AssetUnwrappedEvent {
  asset: string;
  amount: string;
}

/**
 * Bridge deposit event data
 */
export interface BridgeDepositEvent {
  chainId: number;
  depositor: string;
  amount: string;
}

/**
 * Bridge withdraw event data
 */
export interface BridgeWithdrawEvent {
  chainId: number;
  recipient: string;
  amount: string;
}

/**
 * Bridge lifecycle event data
 */
export interface BridgeLifecycleEvent {
  bridgeId: string;
}

/**
 * Relayer event data
 */
export interface RelayerEvent {
  relayer: string;
}

/**
 * Bridge transaction event data
 */
export interface BridgeTxEvent {
  txHash: string;
  status: string;
}

/**
 * Contract lifecycle event data
 */
export interface ContractLifecycleEvent {
  contractId: string;
}

/**
 * Upgrade event data
 */
export interface UpgradeEvent {
  contractId: string;
  newWasmHash: string;
}

/**
 * Project status changed event data
 */
export interface ProjectStatusEvent {
  projectId: number;
  status: string;
}

/**
 * Event that could not be decoded and was quarantined.
 * Persisted separately so it can be inspected/retried without blocking
 * the indexer or corrupting domain tables.
 */
export interface QuarantinedEvent {
  eventId: string;
  network: string;
  contractId: string;
  eventType: ContractEventType;
  ledgerSeq: number;
  transactionHash: string;
  rawXdr: string;
  reason: string;
  createdAt: Date;
}
