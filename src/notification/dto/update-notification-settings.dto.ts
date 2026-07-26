import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export const updateNotificationSettingsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  notifyContributions: z.boolean().optional(),
  notifyMilestones: z.boolean().optional(),
  notifyDeadlines: z.boolean().optional(),
});

export type UpdateNotificationSettingsDto = z.infer<typeof updateNotificationSettingsSchema>;
