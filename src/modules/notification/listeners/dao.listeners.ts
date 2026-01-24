import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification.service';
import { EventNames } from '../../../events';
import {
  DaoProposalCreatedEvent,
  DaoProposalFinalizedEvent,
} from '../../../events/dao';

/**
 * Event listeners for DAO-related notifications.
 * Maps domain events to user notifications.
 */
@Injectable()
export class DaoEventListeners {
  private readonly logger = new Logger(DaoEventListeners.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(EventNames.DAO_PROPOSAL_CREATED)
  handleDaoProposalCreated(event: DaoProposalCreatedEvent): void {
    this.logger.debug(
      `Handling dao.proposal.created event for proposal ${event.proposalId}`,
    );

    this.notificationService.createDaoNotification(
      event.creatorId,
      event.proposalId,
      'Proposal Created',
      `Your DAO proposal "${event.title}" (ID: ${event.proposalId}) has been created and is open for voting.`,
    );
  }

  @OnEvent(EventNames.DAO_PROPOSAL_FINALIZED)
  handleDaoProposalFinalized(event: DaoProposalFinalizedEvent): void {
    this.logger.debug(
      `Handling dao.proposal.finalized event for proposal ${event.proposalId}`,
    );

    const result = event.passed ? 'passed' : 'did not pass';

    this.notificationService.createDaoNotification(
      event.creatorId,
      event.proposalId,
      'Proposal Voting Ended',
      `Voting has ended for your DAO proposal (ID: ${event.proposalId}). Result: The proposal ${result}.`,
    );
  }
}
