import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Claim } from './entities/claim.entity';
import { DuplicateClaimCheck } from './entities/duplicate-claim-check.entity';
import { ClaimService } from './services/claim.service';
import { PolicyValidationService } from './services/policy-validation.service';
import { DuplicateDetectionService } from './services/duplicate-detection.service';
import { ClaimController } from './controllers/claim.controller';
import { ClaimOwnerGuard } from './guards/claim-owner.guard';
import { AuditModule } from '../modules/audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Claim, DuplicateClaimCheck]), AuditModule],
  providers: [
    ClaimService,
    PolicyValidationService,
    DuplicateDetectionService,
    ClaimOwnerGuard,
  ],
  controllers: [ClaimController],
  exports: [ClaimService, PolicyValidationService, DuplicateDetectionService],
})
export class ClaimsModule {}
