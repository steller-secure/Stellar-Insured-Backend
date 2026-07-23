import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { ReputationService } from './reputation.service';
import { ReputationEventListener } from '../common/events/listeners/reputation-event.listener';

@Module({
  imports: [DatabaseModule],
  providers: [ReputationService, ReputationEventListener],
  exports: [ReputationService],
})
export class ReputationModule {}
