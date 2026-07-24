import { z } from 'zod';
import { sanitizeString } from '../../common/utils/sanitization.util';

export const walletAddressSchema = z.object({
  address: z.string().min(1).max(256).regex(/^[A-Za-z0-9_\-.@]+$/, {
    message: 'Wallet address must only contain alphanumeric characters and _-.@',
  }).transform(sanitizeString),
});

export type WalletAddressDto = z.infer<typeof walletAddressSchema>;
