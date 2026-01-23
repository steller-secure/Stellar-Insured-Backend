import { Entity, Column, ManyToOne, OneToMany, OneToOne, Index } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { User } from '../../users/entities/user.entity';
import { Policy } from '../../policy/entities/policy.entity';
import { ClaimStatus } from '../enums/claim-status.enum';
import { ClaimStatusHistory } from './claim-status-history.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('claims')
export class Claim extends BaseEntity {
  @Column({ unique: true })
  @Index()
  claimNumber: string;

  @Column({
    type: 'enum',
    enum: ClaimStatus,
    default: ClaimStatus.SUBMITTED,
  })
  status: ClaimStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  claimedAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  approvedAmount?: number;

  @ManyToOne(() => User, (user) => user.claims)
  user: User;

  @ManyToOne(() => Policy, (policy) => policy.claims)
  policy: Policy;

  @OneToMany(() => ClaimStatusHistory, (history) => history.claim)
  statusHistory: ClaimStatusHistory[];

  @OneToOne(() => Payment, (payment) => payment.claim)
  payment: Payment;

  @Column({ type: 'jsonb', nullable: true })
  evidence?: Record<string, any>;
}
