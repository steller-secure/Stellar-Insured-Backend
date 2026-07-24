import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const presignUrlSchema = z.object({
  key: z.string(),
  expiresIn: z.number().min(60).max(604800).optional().default(3600),
});

export type PresignUrlDto = z.infer<typeof presignUrlSchema>;
