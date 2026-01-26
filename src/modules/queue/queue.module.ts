import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '../../config/config.module'; // Adjusted to match your previous app.module imports
import { QueueService } from './queue.service';
import { AuditLogProcessor } from './processors/audit-log.processor';
import { QueueController } from './queue.controller';
import { GlobalQueueErrorHandler } from './global-queue-error.handler';
import { QueueList } from './queue.config';

@Module({
  imports: [
    // 1. Configure Bull with proper typing
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          // FIX: Removed <string>, <number> generics
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: configService.get('QUEUE_JOB_ATTEMPTS', 3),
          backoff: {
            type: 'exponential',
            delay: configService.get('QUEUE_JOB_BACKOFF_DELAY') || 2000,
          },
          defaultJobOptions: {
            attempts: configService.get<number>('QUEUE_JOB_ATTEMPTS', 3),
            backoff: {
              type: 'exponential' as const, // Type assertion
              delay: configService.get<number>('QUEUE_JOB_BACKOFF_DELAY', 2000),
            },
            removeOnComplete: true,
            removeOnFail: false,
          },
          settings: {
            stalledInterval: 5000,
            maxStalledCount: 2,
            lockDuration: 30000,
            lockRenewTime: 15000,
          },
        };
        return options;
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(...QueueList),
  ],
  controllers: [QueueController],
  providers: [QueueService, AuditLogProcessor, GlobalQueueErrorHandler],
  exports: [QueueService, BullModule],
})
export class QueueModule {}