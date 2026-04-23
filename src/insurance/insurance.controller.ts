import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InsuranceService } from './insurance.service';
import { ClaimService } from './claim.service';
import { ReinsuranceService } from './reinsurance.service';
import { RiskType } from './enums/risk-type.enum';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from './enums/role.enum';
import { CsrfGuard } from '../csrf/csrf.guard';

@Controller('api/insurance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InsuranceController {
  constructor(
    private readonly insurance: InsuranceService,
    private readonly claims: ClaimService,
    private readonly reinsurance: ReinsuranceService,
  ) {}

  // Any authenticated user can purchase a policy
  @Post('purchase')
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 purchases per hour
  @UseGuards(CsrfGuard)
  @Roles(Role.USER, Role.UNDERWRITER, Role.ADMIN)
  async purchase(@Body() body: { userId: string; poolId: string; riskType: RiskType; coverageAmount: number }) {
    return this.insurance.purchasePolicy(body.userId, body.poolId, body.riskType, body.coverageAmount);
  }

  // Only underwriters and admins can assess claims
  @Post('claims/:claimId/assess')
  @Throttle({ admin: { limit: 100, ttl: 60000 } }) // 100 assessments per minute for admins
  @UseGuards(CsrfGuard)
  @Roles(Role.UNDERWRITER, Role.ADMIN)
  async assessClaim(@Param('claimId') claimId: string) {
    return this.claims.assessClaim(claimId);
  }

  // Only admins can trigger claim payouts
  @Post('claims/:claimId/pay')
  @Throttle({ admin: { limit: 50, ttl: 60000 } }) // 50 payouts per minute for admins
  @UseGuards(CsrfGuard)
  @Roles(Role.ADMIN)
  async payClaim(@Param('claimId') claimId: string) {
    return this.claims.payClaim(claimId);
  }

  // Only admins can create reinsurance contracts
  @Post('reinsurance')
  @Throttle({ admin: { limit: 20, ttl: 60000 } }) // 20 contracts per minute for admins
  @UseGuards(CsrfGuard)
  @Roles(Role.ADMIN)
  async createReinsurance(@Body() body: { poolId: string; coverageLimit: number; premiumRate: number }) {
    return this.reinsurance.createContract(body.poolId, body.coverageLimit, body.premiumRate);
  }
}
