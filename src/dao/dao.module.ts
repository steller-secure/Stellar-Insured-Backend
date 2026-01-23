import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProposalController } from './controllers/proposal.controller';
import { ProposalService } from './services/proposal.service';
import { Proposal } from './entities/proposal.entity';
import { User } from '../modules/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Proposal, User])],
  controllers: [ProposalController],
  providers: [ProposalService],
  exports: [ProposalService],
})
export class DAOModule {}
