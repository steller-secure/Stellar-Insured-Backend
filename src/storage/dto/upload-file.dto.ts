import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const uploadFileSchema = z.object({
  prefix: z.string().max(256).regex(/^[a-zA-Z0-9\-_/]*$/, {
    message: 'Prefix must contain only alphanumeric chars, hyphens, underscores, or slashes',
  }).optional(),
});

export type UploadFileDto = z.infer<typeof uploadFileSchema>;
