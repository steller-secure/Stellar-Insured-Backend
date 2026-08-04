import { Prisma } from '@prisma/client';
import { PricingService } from './pricing.service';
import { RiskType } from './enums/risk-type.enum';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('calculatePremium', () => {
    it('should calculate premium for PROJECT_FAILURE risk type (5%)', () => {
      const premium = service.calculatePremium(RiskType.PROJECT_FAILURE, new Prisma.Decimal(10000));
      expect(premium).toBe(500); // 10000 * 0.05
    });

    it('should calculate premium for SMART_CONTRACT_EXPLOIT risk type (8%)', () => {
      const premium = service.calculatePremium(RiskType.SMART_CONTRACT_EXPLOIT, new Prisma.Decimal(10000));
      expect(premium).toBe(800); // 10000 * 0.08
    });

    it('should calculate premium for MARKET_VOLATILITY risk type (3%)', () => {
      const premium = service.calculatePremium(RiskType.MARKET_VOLATILITY, new Prisma.Decimal(10000));
      expect(premium).toBe(300); // 10000 * 0.03
    });

    it('should return 0 for zero coverage amount', () => {
      const premium = service.calculatePremium(RiskType.PROJECT_FAILURE, new Prisma.Decimal(0));
      expect(premium).toBe(0);
    });

    it('should handle large coverage amounts correctly', () => {
      const premium = service.calculatePremium(RiskType.SMART_CONTRACT_EXPLOIT, new Prisma.Decimal(1000000));
      expect(premium).toBe(80000); // 1000000 * 0.08
    });

    it('should handle decimal coverage amounts', () => {
      const premium = service.calculatePremium(RiskType.MARKET_VOLATILITY, new Prisma.Decimal(1500.5));
      expect(premium).toBeCloseTo(45.015, 2); // 1500.5 * 0.03
    });

    it('should calculate different premiums for different risk types with same coverage', () => {
      const coverage = 50000;
      const projectFailure = service.calculatePremium(RiskType.PROJECT_FAILURE, new Prisma.Decimal(coverage));
      const smartContract = service.calculatePremium(RiskType.SMART_CONTRACT_EXPLOIT, new Prisma.Decimal(coverage));
      const marketVolatility = service.calculatePremium(RiskType.MARKET_VOLATILITY, new Prisma.Decimal(coverage));

      expect(marketVolatility).toBeLessThan(projectFailure);
      expect(projectFailure).toBeLessThan(smartContract);
    });
  });
});
