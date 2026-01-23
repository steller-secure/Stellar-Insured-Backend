import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { User } from './user.entity';

@Entity('user_onboarding_checklists')
export class UserOnboardingChecklist extends BaseEntity {
  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ default: false })
  walletVerified: boolean;

  @Column({ default: false })
  profileCompleted: boolean;

  @Column({ default: false })
  kycStarted: boolean;

  @Column({ default: false })
  kycCompleted: boolean;

  @Column({ default: false })
  paymentMethodAdded: boolean;

  @Column({ default: false })
  firstPolicyPurchased: boolean;

  @Column({ default: false })
  profilePictureUploaded: boolean;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ default: false })
  termsAccepted: boolean;

  @Column({ type: 'int', default: 0 })
  completionPercentage: number;
}
