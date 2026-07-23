import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../../notification/services/notification.service';
import { NotificationType } from '../../../notification/enums/notification-type.enum';
import { DomainEvent } from '../domain-event.interface';
import {
  DomainEventName,
  IndexerContributionMadePayload,
  IndexerMilestoneApprovedPayload,
  IndexerMilestoneRejectedPayload,
} from '../event-types';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(DomainEventName.INDEXER_CONTRIBUTION_MADE)
  async handleContributionMade(
    event: DomainEvent<
      DomainEventName.INDEXER_CONTRIBUTION_MADE,
      IndexerContributionMadePayload
    >,
  ) {
    const { userId, projectId, projectTitle, amount } = event.payload;
    try {
      await this.notificationService.notify(
        userId,
        NotificationType.CONTRIBUTION,
        'Contribution Successful!',
        `Your contribution of ${amount} to project ${projectTitle} was successful.`,
        { projectId, amount },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Failed to send contribution notification to user ${userId}: ${msg}`,
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
    const { projectId, projectTitle, milestoneId, investorIds } = event.payload;
    for (const investorId of investorIds) {
      try {
        await this.notificationService.notify(
          investorId,
          NotificationType.MILESTONE,
          'Project Milestone Reached!',
          `A project you back (${projectTitle}) has reached a new milestone!`,
          { projectId, milestoneId },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(
          `Failed to notify investor ${investorId} of milestone: ${msg}`,
        );
      }
    }
  }

  @OnEvent(DomainEventName.INDEXER_MILESTONE_REJECTED)
  async handleMilestoneRejected(
    event: DomainEvent<
      DomainEventName.INDEXER_MILESTONE_REJECTED,
      IndexerMilestoneRejectedPayload
    >,
  ) {
    const { projectId, projectTitle, milestoneId, investorIds } = event.payload;
    for (const investorId of investorIds) {
      try {
        await this.notificationService.notify(
          investorId,
          NotificationType.MILESTONE,
          'Project Milestone Failed',
          `A project you back (${projectTitle}) has a failed milestone!`,
          { projectId, milestoneId },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(
          `Failed to notify investor ${investorId} of milestone: ${msg}`,
        );
      }
    }
  }
}
