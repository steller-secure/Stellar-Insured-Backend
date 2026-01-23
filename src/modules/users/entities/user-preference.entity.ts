import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { User } from './user.entity';

@Entity('user_preferences')
export class UserPreference extends BaseEntity {
  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ default: true })
  emailNotificationsEnabled: boolean;

  @Column({ default: false })
  smsNotificationsEnabled: boolean;

  @Column({ default: true })
  pushNotificationsEnabled: boolean;

  @Column({ default: true })
  receivePromotionalEmails: boolean;

  @Column({ default: 'en' })
  preferredLocale: string;

  @Column({ nullable: true })
  timezone?: string;
}
