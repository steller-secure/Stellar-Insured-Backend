import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const pinMetadataSchema = z.object({
  metadata: z.any(),
  name: z.string().optional(),
});

export type PinMetadataDto = z.infer<typeof pinMetadataSchema>;
