import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { Policy } from '../../policy/entities/policy.entity';
import { Claim } from '../../claims/entities/claim.entity';
import { Payment } from '../../payments/entities/payment.entity';
import type { Vote } from '../../dao/entities/vote.entity';
import type { Proposal } from '../../dao/entities/proposal.entity';

export enum UserRole {
  USER = 'USER',
  ORACLE = 'ORACLE',
  DAO = 'DAO',
  ADMIN = 'ADMIN',
}

export enum SignupSource {
  ORGANIC = 'ORGANIC',
  REFERRAL = 'REFERRAL',
  MARKETING_CAMPAIGN = 'MARKETING_CAMPAIGN',
  BULK_IMPORT = 'BULK_IMPORT',
  API = 'API',
  PARTNERSHIP = 'PARTNERSHIP',
}

export enum UserStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  @Index()
  walletAddress: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    array: true,
    default: [UserRole.USER],
  })
  roles: UserRole[];

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({
    type: 'enum',
    enum: SignupSource,
    default: SignupSource.ORGANIC,
  })
  signupSource: SignupSource;

  @Column({ nullable: true })
  referralCode?: string;

  @Column({ nullable: true })
  referrerId?: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isWalletVerified: boolean;

  @Column({ default: false })
  kycVerified: boolean;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => Policy, (policy) => policy.user)
  policies: Policy[];

  @OneToMany(() => Claim, (claim) => claim.user)
  claims: Claim[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  @OneToMany('Vote', 'user')
  votes: Vote[];

  @OneToMany('Proposal', 'createdBy')
  proposals: Proposal[];
}
