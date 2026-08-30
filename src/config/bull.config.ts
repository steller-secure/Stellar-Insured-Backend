import { ConfigService, registerAs } from '@nestjs/config';
import { BullModuleOptions } from '@nestjs/bull';
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

export default registerAs('queue', () => ({
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  retryLimits: {
    email: parseInt(process.env.EMAIL_QUEUE_MAX_ATTEMPTS || '5', 10),
    push: parseInt(process.env.PUSH_QUEUE_MAX_ATTEMPTS || '5', 10),
    ipfsPin: parseInt(process.env.IPFS_PIN_QUEUE_MAX_ATTEMPTS || '5', 10),
  },
}));

/**
 * Builds a shared Bull connection config from environment variables.
 * Falls back to the local Redis defaults already defined in .env.example.
 */
export function bullConfig(config: ConfigService): BullModuleOptions {
  const redisUrl = config.get<string>('queue.redis.url', 'redis://localhost:6379');
  const db = config.get<number>('queue.redis.db', 0);

  return {
    url: redisUrl,
    redis: {
      db,
    },
  };
}
