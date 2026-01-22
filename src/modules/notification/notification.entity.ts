import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  CLAIM = 'claim',
  POLICY = 'policy',
  DAO = 'dao',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification {
  @ApiProperty({ description: 'Unique identifier for the notification' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID this notification belongs to' })
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
  })
  @Column({
    type: 'enum',
    enum: NotificationType,
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
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Whether the notification has been read' })
  @Index()
  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @ApiProperty({ description: 'When the notification was created' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'When the notification was last updated' })
  @UpdateDateColumn()
  updatedAt: Date;
}
