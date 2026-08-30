import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '../../config/bull.config';

/**
 * Bull queue health indicator.
 * Healthy: queue client connected and can retrieve job counts.
 * Unhealthy: Redis disconnected, queue paused unexpectedly, or timeout.
 * Required: Critical for job processing (email, push notifications, IPFS pinning).
 * Note: a non-empty failed jobs count is tracked but does not cause unhealthy status.
 */
@Injectable()
export class BullHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(BullHealthIndicator.name);
  private readonly HEALTH_CHECK_TIMEOUT = 3000; // 3 second timeout

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emailQueue: Queue,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Get job counts to verify queue connectivity and functionality
      const counts = await Promise.race([
        this.emailQueue.getJobCounts(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Bull health check timeout after ${this.HEALTH_CHECK_TIMEOUT}ms`)),
            this.HEALTH_CHECK_TIMEOUT,
          ),
        ),
      ]);
      
      return this.getStatus(key, true, {
        type: 'bull',
        status: 'connected',
        message: 'Bull queue operational',
        jobCounts: {
          active: counts.active,
          completed: counts.completed,
          failed: counts.failed,
          delayed: counts.delayed,
          waiting: counts.waiting,
        },
      });
    } catch (error) {
      this.logger.error(
        `Bull queue health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HealthCheckError(
        'Bull queue health check failed',
        this.getStatus(key, false, {
          type: 'bull',
          status: 'down',
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}
