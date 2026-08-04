import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class IdempotencyCleanupTask {
  private readonly logger = new Logger(IdempotencyCleanupTask.name);
  private readonly STALE_THRESHOLD_HOURS = 48; // Keep keys for 48 hours

  constructor(private readonly prisma: PrismaService) {}

  // Run daily at midnight to clean up stale idempotency keys
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.debug('Starting stale idempotency key cleanup...');
    
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - this.STALE_THRESHOLD_HOURS);

    try {
      const { count } = await this.prisma.idempotencyKey.deleteMany({
        where: {
          createdAt: {
            lt: staleDate,
          },
        },
      });

      this.logger.log(`Successfully deleted ${count} stale idempotency keys`);
    } catch (error) {
      this.logger.error('Failed to clean up stale idempotency keys', error);
    }
  }
}