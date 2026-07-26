import { Injectable, Logger } from '@nestjs/common';
import { xdr, scValToNative, Address } from '@stellar/stellar-sdk';
import { ContractEventType } from '../types/event-types';

/**
 * Result of decoding an event value.
 * `data` holds the decoded, typed fields (never raw XDR).
 * `rawXdr` is only retained for debug/quarantine purposes.
 */
export interface DecodedEvent {
  data: Record<string, unknown>;
  rawXdr: string;
}

/**
 * Service responsible for decoding raw Soroban event XDR values
 * (xdr.ScVal) into structured, typed fields the domain handlers can use.
 *
 * Every supported ContractEventType has a dedicated decoder that knows the
 * expected on-chain shape (project id, addresses, amounts, statuses, ...).
 * Unknown or malformed XDR is never thrown to the caller - it is returned as a
 * "quarantined" result so the indexer can log and persist it without crashing.
 */
@Injectable()
export class XdrDecoderService {
  private readonly logger = new Logger(XdrDecoderService.name);

  /**
   * Decode a raw event value XDR string for the given event type.
   *
   * @param valueXdr base64 XDR string of the event value (xdr.ScVal)
   * @param eventType the parsed ContractEventType
   * @returns decoded fields; on failure returns a quarantined payload
   */
  decode(valueXdr: string, eventType: ContractEventType): DecodedEvent {
    // 1. Parse the XDR into an xdr.ScVal.
    let scVal: xdr.ScVal;
    try {
      scVal = xdr.ScVal.fromXDR(valueXdr, 'base64');
    } catch (error) {
      this.logger.warn(`Quarantined event (bad XDR, ${eventType}): ${error.message}`);
      return this.quarantine(valueXdr, `invalid_xdr: ${error.message}`);
    }

    // 2. Convert the ScVal into native JS (objects/arrays/strings/bigints).
    let native: unknown;
    try {
      native = scValToNative(scVal);
    } catch (error) {
      this.logger.warn(`Quarantined event (undecodable ScVal, ${eventType}): ${error.message}`);
      return this.quarantine(valueXdr, `undecodable_scval: ${error.message}`);
    }

    // 3. Route to the per-type decoder to coerce/normalize known fields.
    const decoder = this.decoders.get(eventType);
    if (!decoder) {
      this.logger.debug(`No structured decoder for ${eventType}; storing native payload`);
      return {
        data: this.normalizeNative(native),
        rawXdr: valueXdr,
      };
    }

    try {
      const data = decoder.call(this, native as Record<string, unknown>);
      return { data, rawXdr: valueXdr };
    } catch (error) {
      this.logger.warn(`Quarantined event (shape mismatch, ${eventType}): ${error.message}`);
      return this.quarantine(valueXdr, `shape_mismatch: ${error.message}`);
    }
  }

  /**
   * Build a quarantined payload. The decoded data field still carries the
   * native representation (best effort) plus a `_quarantined` marker and
   * a human readable reason so downstream code never treats it as valid.
   */
  private quarantine(valueXdr: string, reason: string): DecodedEvent {
    return {
      data: {
        _quarantined: true,
        _quarantineReason: reason,
        rawXdr: valueXdr,
      },
      rawXdr: valueXdr,
    };
  }

  /**
   * Convert a native (already decoded) payload into a JSON-safe record.
   * BigInts become strings so they survive serialization to the DB.
   */
  private normalizeNative(value: unknown): Record<string, unknown> {
    if (Array.isArray(value)) {
      return { items: value.map((v) => this.coerceScalar(v)) };
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.coerceScalar(v);
      }
      return out;
    }
    return { value: this.coerceScalar(value) };
  }

  /**
   * Coerce a scalar into a JSON-safe representation.
   * Address/Buffer objects, bigints and numbers are normalized to strings.
   */
  private coerceScalar(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }
    if (value instanceof Address) return value.toString();
    if (Buffer.isBuffer(value)) return value.toString('base64');
    if (Array.isArray(value)) return value.map((v) => this.coerceScalar(v));
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.coerceScalar(v);
      }
      return out;
    }
    return String(value);
  }

  // ---------------------------------------------------------------------------
  // Per-event-type decoders
  //
  // Soroban contract events emit their body as an xdr.ScVal. The most common
  // shapes are a `Vec` (decoded to an array) or a `Map` (decoded to an object).
  // We handle both: array elements are matched positionally by the documented
  // contract event schema, object members are matched by key.
  // ---------------------------------------------------------------------------

  private readonly decoders = new Map<ContractEventType, (n: Record<string, unknown>) => Record<string, unknown>>([
    [ContractEventType.PROJECT_CREATED, this.decodeProjectCreated],
    [ContractEventType.PROJECT_FUNDED, this.decodeProjectFunded],
    [ContractEventType.PROJECT_COMPLETED, this.decodeProjectStatus],
    [ContractEventType.PROJECT_FAILED, this.decodeProjectStatus],
    [ContractEventType.CONTRIBUTION_MADE, this.decodeContributionMade],
    [ContractEventType.REFUND_ISSUED, this.decodeRefundIssued],
    [ContractEventType.ESCROW_INITIALIZED, this.decodeEscrowInitialized],
    [ContractEventType.FUNDS_LOCKED, this.decodeFundsLocked],
    [ContractEventType.FUNDS_RELEASED, this.decodeFundsReleased],
    [ContractEventType.MILESTONE_CREATED, this.decodeMilestoneCreated],
    [ContractEventType.MILESTONE_SUBMITTED, this.decodeMilestoneSubmitted],
    [ContractEventType.MILESTONE_APPROVED, this.decodeMilestoneApproved],
    [ContractEventType.MILESTONE_REJECTED, this.decodeMilestoneRejected],
    [ContractEventType.MILESTONE_COMPLETED, this.decodeMilestoneCompleted],
    [ContractEventType.VALIDATORS_UPDATED, this.decodeValidatorsUpdated],
    [ContractEventType.PROFIT_DISTRIBUTED, this.decodeProfitDistributed],
    [ContractEventType.DIVIDEND_CLAIMED, this.decodeDividendClaimed],
    [ContractEventType.PROPOSAL_CREATED, this.decodeProposalCreated],
    [ContractEventType.VOTE_CAST, this.decodeVoteCast],
    [ContractEventType.PROPOSAL_EXECUTED, this.decodeProposalExecuted],
    [ContractEventType.USER_REGISTERED, this.decodeUserRegistered],
    [ContractEventType.REPUTATION_UPDATED, this.decodeReputationUpdated],
    [ContractEventType.BADGE_EARNED, this.decodeBadgeEarned],
    [ContractEventType.PAYMENT_SETUP, this.decodePaymentSetup],
    [ContractEventType.PAYMENT_RECEIVED, this.decodePaymentReceived],
    [ContractEventType.PAYMENT_WITHDRAWN, this.decodePaymentWithdrawn],
    [ContractEventType.SUBSCRIPTION_CREATED, this.decodeSubscriptionCreated],
    [ContractEventType.SUBSCRIPTION_CANCELLED, this.decodeSubscriptionStatus],
    [ContractEventType.SUBSCRIPTION_MODIFIED, this.decodeSubscriptionModified],
    [ContractEventType.SUBSCRIPTION_PAUSED, this.decodeSubscriptionStatus],
    [ContractEventType.SUBSCRIPTION_RESUMED, this.decodeSubscriptionStatus],
    [ContractEventType.PAYMENT_FAILED, this.decodePaymentFailed],
    [ContractEventType.SUBSCRIPTION_PAYMENT, this.decodeSubscriptionPayment],
    [ContractEventType.BRIDGE_INITIALIZED, this.decodeBridgeInitialized],
    [ContractEventType.SUPPORTED_CHAIN_ADDED, this.decodeChainAdded],
    [ContractEventType.SUPPORTED_CHAIN_REMOVED, this.decodeChainRemoved],
    [ContractEventType.ASSET_WRAPPED, this.decodeAssetWrapped],
    [ContractEventType.ASSET_UNWRAPPED, this.decodeAssetUnwrapped],
    [ContractEventType.BRIDGE_DEPOSIT, this.decodeBridgeDeposit],
    [ContractEventType.BRIDGE_WITHDRAW, this.decodeBridgeWithdraw],
    [ContractEventType.BRIDGE_PAUSED, this.decodeBridgeLifecycle],
    [ContractEventType.BRIDGE_UNPAUSED, this.decodeBridgeLifecycle],
    [ContractEventType.RELAYER_ADDED, this.decodeRelayer],
    [ContractEventType.RELAYER_REMOVED, this.decodeRelayer],
    [ContractEventType.BRIDGE_TX_CONFIRMED, this.decodeBridgeTx],
    [ContractEventType.BRIDGE_TX_FAILED, this.decodeBridgeTx],
    [ContractEventType.CONTRACT_PAUSED, this.decodeContractLifecycle],
    [ContractEventType.CONTRACT_RESUMED, this.decodeContractLifecycle],
    [ContractEventType.UPGRADE_SCHEDULED, this.decodeUpgrade],
    [ContractEventType.UPGRADE_EXECUTED, this.decodeUpgrade],
    [ContractEventType.UPGRADE_CANCELLED, this.decodeUpgrade],
  ]);

  // --- Helpers for field extraction -----------------------------------------

  private asObject(n: Record<string, unknown>): Record<string, unknown> {
    return n && typeof n === 'object' ? n : {};
  }

  private field(obj: Record<string, unknown>, key: string): unknown {
    if (obj[key] !== undefined) return obj[key];
    // When the payload is an array (Vec), positional matching is impossible
    // without a contract-specific schema; fall back to a best-effort lookup
    // by lowercased/normalized key.
    const alt = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase());
    return alt ? obj[alt] : undefined;
  }

  private str(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'bigint' || typeof value === 'number') return value.toString();
    if (value instanceof Address) return value.toString();
    if (Buffer.isBuffer(value)) return value.toString('base64');
    return String(value);
  }

  private num(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseInt(value, 10) || 0;
    return 0;
  }

  private bigStr(value: unknown): string {
    if (value === null || value === undefined) return '0';
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number') return BigInt(Math.floor(value)).toString();
    if (typeof value === 'string') return value;
    return '0';
  }

  // --- Decoder implementations ----------------------------------------------

  private decodeProjectCreated(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      creator: this.str(this.field(o, 'creator') ?? this.field(o, 'owner')),
      fundingGoal: this.bigStr(this.field(o, 'funding_goal') ?? this.field(o, 'goal')),
      deadline: this.num(this.field(o, 'deadline')),
      token: this.str(this.field(o, 'token')),
    };
  }

  private decodeProjectFunded(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      amount: this.bigStr(this.field(o, 'amount')),
      totalRaised: this.bigStr(this.field(o, 'total_raised')),
    };
  }

  private decodeProjectStatus(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    const status = this.str(this.field(o, 'status'));
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      status: status || 'unknown',
    };
  }

  private decodeContributionMade(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      contributor: this.str(this.field(o, 'contributor') ?? this.field(o, 'investor')),
      amount: this.bigStr(this.field(o, 'amount')),
      totalRaised: this.bigStr(this.field(o, 'total_raised')),
    };
  }

  private decodeRefundIssued(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      contributor: this.str(this.field(o, 'contributor')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeEscrowInitialized(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      escrowId: this.str(this.field(o, 'escrow_id')),
      totalAmount: this.bigStr(this.field(o, 'total_amount')),
    };
  }

  private decodeFundsLocked(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      milestoneId: this.num(this.field(o, 'milestone_id')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeFundsReleased(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      milestoneId: this.num(this.field(o, 'milestone_id')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeMilestoneCreated(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      milestoneId: this.num(this.field(o, 'milestone_id')),
      fundingAmount: this.bigStr(this.field(o, 'funding_amount')),
    };
  }

  private decodeMilestoneSubmitted(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      milestoneId: this.num(this.field(o, 'milestone_id')),
      submitter: this.str(this.field(o, 'submitter')),
    };
  }

  private decodeMilestoneApproved(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      milestoneId: this.num(this.field(o, 'milestone_id')),
      approvalCount: this.num(this.field(o, 'approval_count')),
    };
  }

  private decodeMilestoneRejected(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      milestoneId: this.num(this.field(o, 'milestone_id')),
      rejectionCount: this.num(this.field(o, 'rejection_count')),
    };
  }

  private decodeMilestoneCompleted(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      milestoneId: this.num(this.field(o, 'milestone_id')),
    };
  }

  private decodeValidatorsUpdated(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    const validators = this.field(o, 'validators');
    return {
      projectId: this.num(this.field(o, 'project_id') ?? this.field(o, 'id')),
      validatorCount: Array.isArray(validators) ? validators.length : this.num(validators),
    };
  }

  private decodeProfitDistributed(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      poolId: this.str(this.field(o, 'pool_id')),
      totalProfit: this.bigStr(this.field(o, 'total_profit')),
      perShare: this.bigStr(this.field(o, 'per_share')),
    };
  }

  private decodeDividendClaimed(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      poolId: this.str(this.field(o, 'pool_id')),
      claimer: this.str(this.field(o, 'claimer')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeProposalCreated(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      proposalId: this.num(this.field(o, 'proposal_id')),
      proposer: this.str(this.field(o, 'proposer')),
      title: this.str(this.field(o, 'title')),
    };
  }

  private decodeVoteCast(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      proposalId: this.num(this.field(o, 'proposal_id')),
      voter: this.str(this.field(o, 'voter')),
      support: this.str(this.field(o, 'support')),
    };
  }

  private decodeProposalExecuted(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      proposalId: this.num(this.field(o, 'proposal_id')),
      success: this.str(this.field(o, 'success')) === 'true' || this.field(o, 'success') === true,
    };
  }

  private decodeUserRegistered(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      user: this.str(this.field(o, 'user') ?? this.field(o, 'address')),
    };
  }

  private decodeReputationUpdated(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      user: this.str(this.field(o, 'user') ?? this.field(o, 'address')),
      score: this.num(this.field(o, 'score')),
      delta: this.num(this.field(o, 'delta')),
    };
  }

  private decodeBadgeEarned(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      user: this.str(this.field(o, 'user') ?? this.field(o, 'address')),
      badge: this.str(this.field(o, 'badge')),
    };
  }

  private decodePaymentSetup(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      paymentId: this.str(this.field(o, 'payment_id')),
      payer: this.str(this.field(o, 'payer')),
      payee: this.str(this.field(o, 'payee')),
    };
  }

  private decodePaymentReceived(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      paymentId: this.str(this.field(o, 'payment_id')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodePaymentWithdrawn(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      paymentId: this.str(this.field(o, 'payment_id')),
      recipient: this.str(this.field(o, 'recipient')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeSubscriptionCreated(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      subscriptionId: this.str(this.field(o, 'subscription_id')),
      subscriber: this.str(this.field(o, 'subscriber')),
      plan: this.str(this.field(o, 'plan')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeSubscriptionStatus(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      subscriptionId: this.str(this.field(o, 'subscription_id')),
      status: this.str(this.field(o, 'status')),
    };
  }

  private decodeSubscriptionModified(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      subscriptionId: this.str(this.field(o, 'subscription_id')),
      plan: this.str(this.field(o, 'plan')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodePaymentFailed(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      subscriptionId: this.str(this.field(o, 'subscription_id')),
      reason: this.str(this.field(o, 'reason')),
    };
  }

  private decodeSubscriptionPayment(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      subscriptionId: this.str(this.field(o, 'subscription_id')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeBridgeInitialized(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      bridgeId: this.str(this.field(o, 'bridge_id')),
      admin: this.str(this.field(o, 'admin')),
    };
  }

  private decodeChainAdded(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      chainId: this.num(this.field(o, 'chain_id')),
      chainName: this.str(this.field(o, 'chain_name')),
    };
  }

  private decodeChainRemoved(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      chainId: this.num(this.field(o, 'chain_id')),
    };
  }

  private decodeAssetWrapped(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      asset: this.str(this.field(o, 'asset')),
      wrappedAsset: this.str(this.field(o, 'wrapped_asset')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeAssetUnwrapped(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      asset: this.str(this.field(o, 'asset')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeBridgeDeposit(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      chainId: this.num(this.field(o, 'chain_id')),
      depositor: this.str(this.field(o, 'depositor')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeBridgeWithdraw(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      chainId: this.num(this.field(o, 'chain_id')),
      recipient: this.str(this.field(o, 'recipient')),
      amount: this.bigStr(this.field(o, 'amount')),
    };
  }

  private decodeBridgeLifecycle(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      bridgeId: this.str(this.field(o, 'bridge_id')),
    };
  }

  private decodeRelayer(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      relayer: this.str(this.field(o, 'relayer')),
    };
  }

  private decodeBridgeTx(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      txHash: this.str(this.field(o, 'tx_hash') ?? this.field(o, 'hash')),
      status: this.str(this.field(o, 'status')),
    };
  }

  private decodeContractLifecycle(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      contractId: this.str(this.field(o, 'contract_id') ?? this.field(o, 'contract')),
    };
  }

  private decodeUpgrade(n: Record<string, unknown>): Record<string, unknown> {
    const o = this.asObject(n);
    return {
      contractId: this.str(this.field(o, 'contract_id') ?? this.field(o, 'contract')),
      newWasmHash: this.str(this.field(o, 'new_wasm_hash') ?? this.field(o, 'wasm_hash')),
    };
  }
}
