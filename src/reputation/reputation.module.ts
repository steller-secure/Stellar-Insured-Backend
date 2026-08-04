import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { ReputationService } from './reputation.service';
import { ReputationRepository } from '../common/repositories/reputation.repository';

@Module({
  imports: [DatabaseModule],
  providers: [ReputationRepository, ReputationService],
  exports: [ReputationService, ReputationRepository],
})
export class ReputationModule {}
