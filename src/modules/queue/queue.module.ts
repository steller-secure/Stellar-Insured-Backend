import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
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
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.getOptional<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: configService.get<number>('QUEUE_JOB_ATTEMPTS', 3),
          backoff: {
            type: 'exponential',
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
