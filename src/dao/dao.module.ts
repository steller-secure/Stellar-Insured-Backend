import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProposalController } from './controllers/proposal.controller';
import { ProposalService } from './services/proposal.service';
import { Proposal } from './entities/proposal.entity';
import { User } from '../modules/users/entities/user.entity';
import { AuditModule } from '../modules/audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Proposal, User]), AuditModule],
  controllers: [ProposalController],
  providers: [ProposalService],
  exports: [ProposalService],
})
export class DAOModule {}
