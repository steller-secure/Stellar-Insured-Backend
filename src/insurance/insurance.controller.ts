import { Controller, Post, Param, Body, UseInterceptors, Version, Get } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { InsuranceService } from './insurance.service';
import { ClaimService } from './claim.service';
import { ReinsuranceService } from './reinsurance.service';
import { PurchasePolicyDto } from './dto/purchase-policy.dto';
import { CreateClaimDto } from './dto/create-claim.dto';
import { CreateReinsuranceDto } from './dto/create-reinsurance.dto';
import { ClaimIdDto } from '../common/dto/claim-id.dto';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { SerializationTransformer } from '../common/utils/serialization.util';

@SkipThrottle({ auth: true })
@Controller({ path: 'insurance', version: '1' })
export class InsuranceController {
  constructor(
    private readonly insurance: InsuranceService,
    private readonly claims: ClaimService,
    private readonly reinsurance: ReinsuranceService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 purchases per hour
  @Version('1')
  @Post('purchase')
  @UseInterceptors(IdempotencyInterceptor)

  async purchase(@Body() body: PurchasePolicyDto) {
    const policy = await this.insurance.purchasePolicy(body.userId, body.poolId, body.riskType, body.coverageAmount);
    return SerializationTransformer.transform(policy);
  }

  @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30 claim creations per hour
  @Post('claims')
  @UseInterceptors(IdempotencyInterceptor)
  async createClaim(@Body() body: CreateClaimDto) {
    const claim = await this.claims.createClaim(body.policyId, body.claimAmount);
    return SerializationTransformer.transform(claim);
  }

  @Throttle({ default: { limit: 50, ttl: 3600000 } }) // 50 claim assessments per hour
  @Version('1')
  @Post('claims/:claimId/assess')
  @Throttle({ admin: { limit: 100, ttl: 60000 } }) // 100 assessments per minute for admins
  @UseInterceptors(IdempotencyInterceptor)

  async assessClaim(@Param('claimId') claimId: string) {
    const claim = await this.claims.assessClaim(claimId);
    return SerializationTransformer.transform(claim);
  }

  @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30 claim payments per hour
  @Version('1')
  @Post('claims/:claimId/pay')
  @Throttle({ admin: { limit: 50, ttl: 60000 } }) // 50 payouts per minute for admins
  @UseInterceptors(IdempotencyInterceptor)

  async payClaim(@Param('claimId') claimId: string) {
    const claim = await this.claims.payClaim(claimId);
    return SerializationTransformer.transform(claim);
  }

  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 reinsurance contracts per hour
  @Version('1')
  @Post('reinsurance')
  @Throttle({ admin: { limit: 20, ttl: 60000 } }) // 20 contracts per minute for admins
  @UseInterceptors(IdempotencyInterceptor)

  async createReinsurance(@Body() body: CreateReinsuranceDto) {
    const contract = await this.reinsurance.createContract(body.poolId, body.coverageLimit, body.premiumRate);
    return SerializationTransformer.transform(contract);
  }

  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 contract releases per hour
  @Post('reinsurance/:contractId/release')
  @Throttle({ admin: { limit: 20, ttl: 60000 } }) // 20 releases per minute for admins
  @UseInterceptors(IdempotencyInterceptor)
  async releaseReinsurance(@Param('contractId') contractId: string) {
    const contract = await this.reinsurance.releaseContract(contractId);
    return SerializationTransformer.transform(contract);
  }

  @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 policy cancellations per hour
  @Post('policies/:policyId/cancel')
  @UseInterceptors(IdempotencyInterceptor)
  async cancelPolicy(@Param('policyId') policyId: string) {
    const policy = await this.insurance.cancelPolicy(policyId);
    return SerializationTransformer.transform(policy);
  }

  @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 policy expirations per hour
  @Post('policies/:policyId/expire')
  @Throttle({ admin: { limit: 50, ttl: 60000 } }) // 50 expirations per minute for admins
  @UseInterceptors(IdempotencyInterceptor)
  async expirePolicy(@Param('policyId') policyId: string) {
    const policy = await this.insurance.expirePolicy(policyId);
    return SerializationTransformer.transform(policy);
  }
}