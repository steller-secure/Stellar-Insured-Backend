import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaimsService } from './claims.service';
import { Claim } from './entities/claim.entity';
import { ClaimStatusHistory } from './entities/claim-status-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Claim, ClaimStatusHistory])],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
