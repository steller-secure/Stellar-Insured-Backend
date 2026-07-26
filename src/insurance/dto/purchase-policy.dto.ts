import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { RiskType } from '../enums/risk-type.enum';

export const purchasePolicySchema = z.object({
  userId: z.string().min(1),
  poolId: z.string().min(1),
  riskType: z.nativeEnum(RiskType),
  coverageAmount: z.string().transform((value) => {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lte(new Prisma.Decimal(0))) {
      throw new Error('Coverage amount must be positive');
    }
    return decimal;
  }),
});

export type PurchasePolicyDto = z.infer<typeof purchasePolicySchema>;
