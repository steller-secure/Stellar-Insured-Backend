import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DaoService } from './dao.service';
import { DaoController } from './dao.controller';
import { Proposal } from './entities/proposal.entity';
import { Vote } from './entities/vote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Proposal, Vote])],
  controllers: [DaoController],
  providers: [DaoService],
  exports: [DaoService],
})
export class DaoModule {}
