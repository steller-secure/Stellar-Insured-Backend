import { Module, Logger } from '@nestjs/common';
// import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '../../config/config.module';
import { QueueService } from './queue.service';
// import { AuditLogProcessor } from './processors/audit-log.processor';
import { QueueController } from './queue.controller';
// import { GlobalQueueErrorHandler } from './global-queue-error.handler';
// import { QueueList } from './queue.config';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    // TEMPORARY: Bull module disabled
    // BullModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: async (configService: ConfigService) => ({
    //     redis: {
    //       host: configService.get('REDIS_HOST', 'localhost'),
    //       port: configService.get('REDIS_PORT', 6379),
    //       password: configService.get('REDIS_PASSWORD'),
    //       db: configService.get('REDIS_DB', 0),
    //     },
    //     defaultJobOptions: {
    //       attempts: configService.get('QUEUE_JOB_ATTEMPTS', 3),
    //       backoff: {
    //         type: 'exponential',
    //         delay: configService.get('QUEUE_JOB_BACKOFF_DELAY') || 2000,
    //       },
    //       removeOnComplete: true,
    //       removeOnFail: false,
    //     },
    //     settings: {
    //       stalledInterval: 5000,
    //       maxStalledCount: 2,
    //       lockDuration: 30000,
    //       lockRenewTime: 15000,
    //     },
    //   }),
    //   inject: [ConfigService],
    // }),
    // BullModule.registerQueue(...QueueList),
  ],
  controllers: [QueueController],
  providers: [
    QueueService, 
    // TEMPORARY: Bull processors disabled
    // AuditLogProcessor, 
    // GlobalQueueErrorHandler,
  ],
  exports: [QueueService], // TEMPORARY: Removed BullModule
})
export class QueueModule {}