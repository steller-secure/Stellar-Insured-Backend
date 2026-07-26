import { z } from 'zod';
import { Prisma } from '@prisma/client';

export const createClaimSchema = z.object({
  policyId: z.string().uuid(),
  claimAmount: z.string().transform((value) => {
    const decimal = new Prisma.Decimal(value);
    if (decimal.lte(new Prisma.Decimal(0))) {
      throw new Error('Claim amount must be positive');
    }
    return decimal;
  }),
});

export type CreateClaimDto = z.infer<typeof createClaimSchema>;
