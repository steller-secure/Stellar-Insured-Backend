import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const pushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export type PushSubscriptionKeysDto = z.infer<typeof pushSubscriptionKeysSchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().min(1),
  keys: pushSubscriptionKeysSchema,
  expirationTime: z.string().optional(),
});

export type PushSubscriptionDto = z.infer<typeof pushSubscriptionSchema>;
