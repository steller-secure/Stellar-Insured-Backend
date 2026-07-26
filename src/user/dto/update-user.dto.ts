import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { sanitizeString, sanitizeObject } from '../../common/utils/sanitization.util';

/**
 * Allowed profile data shape – restricts keys to known safe fields
 * and prevents arbitrary nested objects.
 */
export const profileDataSchema = z.object({
  displayName: z.string().max(200).optional().transform(sanitizeString),
  bio: z.string().max(500).optional().transform(sanitizeString),
  avatarUrl: z.string().max(500).optional().transform(sanitizeString),
});

export type ProfileDataDto = z.infer<typeof profileDataSchema>;

export const updateUserSchema = z.object({
  email: z.string().email().max(254).optional().transform(sanitizeString),
  profileData: profileDataSchema.optional(),
  pushSubscription: z.string().max(5000).optional().transform(sanitizeString),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
