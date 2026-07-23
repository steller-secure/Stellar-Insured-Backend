import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RiskType } from './enums/risk-type.enum';

@Injectable()
export class PricingService {
  calculatePremium(
    riskType: RiskType,
    coverageAmount: Prisma.Decimal,
  ): Prisma.Decimal {
    const baseRates: Record<RiskType, Prisma.Decimal> = {
      [RiskType.PROJECT_FAILURE]: new Prisma.Decimal('0.05'),
      [RiskType.SMART_CONTRACT_EXPLOIT]: new Prisma.Decimal('0.08'),
      [RiskType.MARKET_VOLATILITY]: new Prisma.Decimal('0.03'),
    };
    return baseRates[riskType].mul(coverageAmount);
  }
}
