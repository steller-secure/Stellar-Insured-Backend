import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification.service';
import { EventNames } from '../../../events';
import {
  PolicyIssuedEvent,
  PolicyRenewedEvent,
  PolicyExpiredEvent,
  PolicyCancelledEvent,
} from '../../../events/policy';

/**
 * Event listeners for policy-related notifications.
 * Maps domain events to user notifications.
 */
@Injectable()
export class PolicyEventListeners {
  private readonly logger = new Logger(PolicyEventListeners.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(EventNames.POLICY_ISSUED)
  handlePolicyIssued(event: PolicyIssuedEvent): void {
    this.logger.debug(
      `Handling policy.issued event for policy ${event.policyId}`,
    );

    this.notificationService.createPolicyNotification(
      event.userId,
      event.policyId,
      'Policy Issued',
      `Your insurance policy (ID: ${event.policyId}) has been issued and is now active.`,
    );
  }

  @OnEvent(EventNames.POLICY_RENEWED)
  handlePolicyRenewed(event: PolicyRenewedEvent): void {
    this.logger.debug(
      `Handling policy.renewed event for policy ${event.policyId}`,
    );

    this.notificationService.createPolicyNotification(
      event.userId,
      event.policyId,
      'Policy Renewed',
      `Your insurance policy (ID: ${event.policyId}) has been successfully renewed.`,
    );
  }

  @OnEvent(EventNames.POLICY_EXPIRED)
  handlePolicyExpired(event: PolicyExpiredEvent): void {
    this.logger.debug(
      `Handling policy.expired event for policy ${event.policyId}`,
    );

    this.notificationService.createPolicyNotification(
      event.userId,
      event.policyId,
      'Policy Expired',
      `Your insurance policy (ID: ${event.policyId}) has expired. Please renew to maintain coverage.`,
    );
  }

  @OnEvent(EventNames.POLICY_CANCELLED)
  handlePolicyCancelled(event: PolicyCancelledEvent): void {
    this.logger.debug(
      `Handling policy.cancelled event for policy ${event.policyId}`,
    );

    this.notificationService.createPolicyNotification(
      event.userId,
      event.policyId,
      'Policy Cancelled',
      `Your insurance policy (ID: ${event.policyId}) has been cancelled. Reason: ${event.reason}`,
    );
  }
}
