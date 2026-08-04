import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';

import { InsuranceController } from './insurance.controller';

import { InsuranceService } from './insurance.service';
import { PoolService } from './pool.service';
import { ClaimService } from './claim.service';
import { ReinsuranceService } from './reinsurance.service';
import { PricingService } from './pricing.service';
import { AuditService } from './services/audit.service';
import { AuditEventListener } from '../common/events/listeners/audit-event.listener';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';

import {
  AuditLogRepository,
  ClaimRepository,
  InsurancePolicyRepository,
  InsurancePoolRepository,
  ReinsuranceContractRepository,
} from '../common/repositories';

@Module({
  imports: [DatabaseModule],
  controllers: [InsuranceController],
  providers: [
    // Repositories
    AuditLogRepository,
    ClaimRepository,
    InsurancePolicyRepository,
    InsurancePoolRepository,
    ReinsuranceContractRepository,
    // Services
    InsuranceService,
    PoolService,
    ClaimService,
    ReinsuranceService,
    PricingService,
    AuditService,
    AuditEventListener,
    IdempotencyInterceptor,
  ],
  exports: [
    InsuranceService,
    PoolService,
    ClaimService,
    ReinsuranceService,
    PricingService,
    AuditService,
    // Export repositories so other modules can use them (e.g. UserModule for cascades)
    AuditLogRepository,
    InsurancePolicyRepository,
    InsurancePoolRepository,
    ClaimRepository,
  ],
})
export class InsuranceModule {}
