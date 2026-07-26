import { z } from 'zod';
import { Prisma } from '@prisma/client';

export const createReinsuranceSchema = z.object({
  poolId: z.string().min(1),
  coverageLimit: z.string().transform((value) => {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lte(new Prisma.Decimal(0))) {
      throw new Error('Coverage limit must be positive');
    }
    return decimal;
  }),
  premiumRate: z.string().transform((value) => {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lt(new Prisma.Decimal(0)) || decimal.gt(new Prisma.Decimal(1))) {
      throw new Error('Premium rate must be between 0 and 1');
    }
    return decimal;
  }),
});

export type CreateReinsuranceDto = z.infer<typeof createReinsuranceSchema>;
