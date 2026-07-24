import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { NotificationType } from '../enums/notification-type.enum';

export const createNotificationSchema = z.object({
  userId: z.string(),
  type: z.nativeEnum(NotificationType),
  title: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.any()).optional(),
});

export type CreateNotificationDto = z.infer<typeof createNotificationSchema>;
