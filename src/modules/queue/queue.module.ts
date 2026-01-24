import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '../../config/config.module'; // Adjusted to match your previous app.module imports
import { AppConfigService } from '../../config/app-config.service';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { AuditLogProcessor } from './processors/audit-log.processor';
import { GlobalQueueErrorHandler } from './global-queue-error.handler';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: AppConfigService) => ({
        redis: {
          // Removed the <type> generics to fix the TS2558 errors
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB') || 0,
        },
        defaultJobOptions: {
          attempts: configService.get('QUEUE_JOB_ATTEMPTS') || 3,
          backoff: {
            type: 'exponential',
            delay: configService.get('QUEUE_JOB_BACKOFF_DELAY') || 2000,
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
      }),
      inject: [AppConfigService],
    }),
    BullModule.registerQueue({
      name: 'audit-logs',
    }),
  ],
  controllers: [QueueController],
  providers: [QueueService, AuditLogProcessor, GlobalQueueErrorHandler],
  exports: [QueueService, BullModule],
})
export class QueueModule {}