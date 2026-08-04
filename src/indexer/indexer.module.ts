import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { IndexerService } from './services/indexer.service';
import { LedgerTrackerService } from './services/ledger-tracker.service';
import { EventHandlerService } from './services/event-handler.service';
import { XdrDecoderService } from './services/xdr-decoder.service';
import { DatabaseModule } from '../database.module';
import { SoftDeleteModule } from '../prisma.soft-delete.module';
import { ReputationModule } from '../reputation/reputation.module';
import { NotificationModule } from '../notification/notification.module';
import stellarConfig, { indexerConfig } from '../config/stellar.config';
import {
  LedgerCursorRepository,
  ProcessedEventRepository,
  QuarantinedEventRepository,
  IndexerLogRepository,
} from '../common/repositories/indexer.repository';
import {
  UserRepository,
  ProjectRepository,
  ContributionRepository,
  MilestoneRepository,
} from '../common/repositories';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    SoftDeleteModule,
    ReputationModule,
    NotificationModule,
    ConfigModule.forFeature(stellarConfig),
    ConfigModule.forFeature(indexerConfig),
  ],
  providers: [
    // Indexer-specific repositories
    LedgerCursorRepository,
    ProcessedEventRepository,
    QuarantinedEventRepository,
    IndexerLogRepository,
    // Shared entity repositories used by event handlers
    UserRepository,
    ProjectRepository,
    ContributionRepository,
    MilestoneRepository,
    // Services
    IndexerService,
    LedgerTrackerService,
    EventHandlerService,
    XdrDecoderService,
  ],
  exports: [IndexerService, LedgerTrackerService, EventHandlerService],
})
export class IndexerModule {}
