import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const verifyHashSchema = z.object({
  hash: z.string().min(1).max(128).regex(/^[a-zA-Z0-9]+$/, {
    message: 'Hash must be alphanumeric',
  }),
});

export type VerifyHashDto = z.infer<typeof verifyHashSchema>;
