import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateNotificationReadStatusDto {
  @ApiProperty({ description: 'Read status of the notification' })
  @IsBoolean()
  isRead: boolean;
}
