import { z } from 'zod';
import { sanitizeString } from '../../common/utils/sanitization.util';

export const userParamsSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9]+$/, {
    message: 'id must be alphanumeric (CUID format)',
  }).transform(sanitizeString),
});

export type UserParamsDto = z.infer<typeof userParamsSchema>;
