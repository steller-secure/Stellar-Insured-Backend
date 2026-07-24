import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const optimizeImageSchema = z.object({
  imagePath: z.string(),
  width: z.number().int().positive().min(1).max(8192),
  height: z.number().int().positive().min(1).max(8192),
});

export type OptimizeImageDto = z.infer<typeof optimizeImageSchema>;
