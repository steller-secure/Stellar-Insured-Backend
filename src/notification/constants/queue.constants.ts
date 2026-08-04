import type * as webpush from 'web-push';

export const QUEUE_NAMES = {
  EMAIL: 'email',
  PUSH: 'push',
  IPFS_PIN: 'ipfs-pin',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface EmailJobData {
  outboxId: string;
  to: string;
  subject: string;
  html: string;
  /**
   * Correlation ID of the request/event that enqueued this job. Bull jobs
   * run outside the AsyncLocalStorage scope of their enqueuer (they may even
   * run in a different process), so it must travel as job data and be
   * re-established by the processor via `runWithTracingContext`.
   */
  correlationId?: string;
}

export interface PushJobData {
  subscription: webpush.PushSubscription;
  payload: {
    title: string;
    body: string;
    data?: unknown;
  };
  correlationId?: string;
}

export interface IpfsPinJobData {
  metadata: Record<string, unknown>;
}

export const EMAIL_MAX_ATTEMPTS = 5;
