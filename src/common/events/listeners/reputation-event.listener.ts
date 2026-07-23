import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReputationService } from '../../../reputation/reputation.service';
import { REPUTATION_DELTAS } from '../../../reputation/reputation.constants';
import { DomainEvent } from '../domain-event.interface';
import {
  DomainEventName,
  IndexerContributionMadePayload,
  IndexerMilestoneApprovedPayload,
  IndexerMilestoneRejectedPayload,
  IndexerDividendClaimedPayload,
  ClaimFraudDetectedPayload,
  ClaimApprovedPayload,
  ClaimRejectedPayload,
} from '../event-types';

@Injectable()
export class ReputationEventListener {
  private readonly logger = new Logger(ReputationEventListener.name);

  constructor(private readonly reputationService: ReputationService) {}

  @OnEvent(DomainEventName.INDEXER_CONTRIBUTION_MADE)
  async handleContributionMade(
    event: DomainEvent<
      DomainEventName.INDEXER_CONTRIBUTION_MADE,
      IndexerContributionMadePayload
    >,
  ) {
    const { userId, projectId, amount } = event.payload;
    try {
      await this.reputationService.adjustReputation(
        userId,
        REPUTATION_DELTAS.CONTRIBUTION_SUCCESS,
        `Contribution of ${amount} to project ${projectId} recorded on-chain`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Failed to adjust reputation for contribution by user ${userId}: ${msg}`,
      );
    }
  }

  @OnEvent(DomainEventName.INDEXER_MILESTONE_APPROVED)
  async handleMilestoneApproved(
    event: DomainEvent<
      DomainEventName.INDEXER_MILESTONE_APPROVED,
      IndexerMilestoneApprovedPayload
    >,
  ) {
    const { creatorId, milestoneId, projectId } = event.payload;
    if (!creatorId) return;

    await this.reputationService.updateTrustScore(creatorId);
    try {
      await this.reputationService.adjustReputation(
        creatorId,
        REPUTATION_DELTAS.MILESTONE_APPROVED,
        `Milestone ${milestoneId} approved for project ${projectId}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Failed to adjust reputation for milestone approval, creator ${creatorId}: ${msg}`,
      );
    }
  }

  @OnEvent(DomainEventName.INDEXER_MILESTONE_REJECTED)
  async handleMilestoneRejected(
    event: DomainEvent<
      DomainEventName.INDEXER_MILESTONE_REJECTED,
      IndexerMilestoneRejectedPayload
    >,
  ) {
    const { creatorId, milestoneId, projectId } = event.payload;
    if (!creatorId) return;

    await this.reputationService.updateTrustScore(creatorId);
    try {
      await this.reputationService.adjustReputation(
        creatorId,
        REPUTATION_DELTAS.MILESTONE_REJECTED,
        `Milestone ${milestoneId} rejected for project ${projectId}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Failed to adjust reputation for milestone rejection, creator ${creatorId}: ${msg}`,
      );
    }
  }

  @OnEvent(DomainEventName.INDEXER_DIVIDEND_CLAIMED)
  async handleDividendClaimed(
    event: DomainEvent<
      DomainEventName.INDEXER_DIVIDEND_CLAIMED,
      IndexerDividendClaimedPayload
    >,
  ) {
    const { userId } = event.payload;
    await this.reputationService.updateTrustScore(userId);
  }

  @OnEvent(DomainEventName.CLAIM_FRAUD_DETECTED)
  async handleClaimFraudDetected(
    event: DomainEvent<
      DomainEventName.CLAIM_FRAUD_DETECTED,
      ClaimFraudDetectedPayload
    >,
  ) {
    const { userId, claimId } = event.payload;
    await this.reputationService.adjustReputation(
      userId,
      REPUTATION_DELTAS.FRAUD_DETECTED,
      `Fraud detected on claim ${claimId}`,
    );
  }

  @OnEvent(DomainEventName.CLAIM_APPROVED)
  async handleClaimApproved(
    event: DomainEvent<DomainEventName.CLAIM_APPROVED, ClaimApprovedPayload>,
  ) {
    const { userId, claimId } = event.payload;
    await this.reputationService.adjustReputation(
      userId,
      REPUTATION_DELTAS.CLAIM_APPROVED,
      `Claim ${claimId} approved`,
    );
  }

  @OnEvent(DomainEventName.CLAIM_REJECTED)
  async handleClaimRejected(
    event: DomainEvent<DomainEventName.CLAIM_REJECTED, ClaimRejectedPayload>,
  ) {
    const { userId, claimId, reason } = event.payload;
    if (!userId) return;

    try {
      await this.reputationService.adjustReputation(
        userId,
        REPUTATION_DELTAS.CLAIM_REJECTED,
        `Claim ${claimId} rejected: ${reason}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Failed to adjust reputation for claim rejection ${claimId}: ${msg}`,
      );
    }
  }
}
