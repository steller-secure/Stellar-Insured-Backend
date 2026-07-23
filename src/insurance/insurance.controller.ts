import {
  Controller,
  Post,
  Param,
  Body,
  UseInterceptors,
  Get,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { InsuranceService } from './insurance.service';
import { ClaimService } from './claim.service';
import { ReinsuranceService } from './reinsurance.service';
import { PurchasePolicyDto } from './dto/purchase-policy.dto';
import { CreateReinsuranceDto } from './dto/create-reinsurance.dto';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { SerializationTransformer } from '../common/utils/serialization.util';
import { InsurancePolicyDto } from '../common/dto/insurance.dto';

@SkipThrottle({ auth: true })
@Controller({ path: 'insurance', version: '1' })
export class InsuranceController {
  constructor(
    private readonly insurance: InsuranceService,
    private readonly claims: ClaimService,
    private readonly reinsurance: ReinsuranceService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 purchases per hour
  @Post('purchase')
  @UseInterceptors(IdempotencyInterceptor)
  async purchase(@Body() body: PurchasePolicyDto) {
    const policy = await this.insurance.purchasePolicy(
      body.userId,
      body.poolId,
      body.riskType,
      body.coverageAmount,
    );
    return SerializationTransformer.transform(policy);
  }

  @Throttle({ default: { limit: 50, ttl: 3600000 } }) // 50 claim assessments per hour
  @Post('claims/:claimId/assess')
  @Throttle({ admin: { limit: 100, ttl: 60000 } }) // 100 assessments per minute for admins
  @UseInterceptors(IdempotencyInterceptor)
  async assessClaim(@Param('claimId') claimId: string) {
    const claim = await this.claims.assessClaim(claimId);
    return SerializationTransformer.transform(claim);
  }

  @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30 claim payments per hour
  @Post('claims/:claimId/pay')
  @Throttle({ admin: { limit: 50, ttl: 60000 } }) // 50 payouts per minute for admins
  @UseInterceptors(IdempotencyInterceptor)
  async payClaim(@Param('claimId') claimId: string) {
    const claim = await this.claims.payClaim(claimId);
    return SerializationTransformer.transform(claim);
  }

  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 reinsurance contracts per hour
  @Post('reinsurance')
  @Throttle({ admin: { limit: 20, ttl: 60000 } }) // 20 contracts per minute for admins
  @UseInterceptors(IdempotencyInterceptor)
  async createReinsurance(@Body() body: CreateReinsuranceDto) {
    const contract = await this.reinsurance.createContract(
      body.poolId,
      body.coverageLimit,
      body.premiumRate,
    );
    return SerializationTransformer.transform(contract);
  }
}
