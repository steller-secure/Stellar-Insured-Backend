import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../common/database/base.entity';
import { User } from '../users/entities/user.entity';

export enum NotificationType {
  CLAIM = 'claim',
  POLICY = 'policy',
  DAO = 'dao',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification extends BaseEntity {
  @ApiProperty({ description: 'User ID this notification belongs to' })
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
  })
  @Column({
    type: 'varchar',
    length: 20,
  })
  type: NotificationType;

  @ApiProperty({ description: 'Title of the notification' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ description: 'Main message content of the notification' })
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({
    description: 'Additional metadata in JSON format',
    required: false,
  })
  @Column({
    type: 'simple-json',
    nullable: true,
  })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Whether the notification has been read' })
  @Index()
  @Column({ type: 'boolean', default: false })
  isRead: boolean;
}
