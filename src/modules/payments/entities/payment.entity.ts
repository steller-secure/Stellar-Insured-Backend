import { Entity, Column, ManyToOne, OneToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { User } from '../../users/entities/user.entity';
import { Policy } from '../../policy/entities/policy.entity';
import { Claim } from '../../claims/entities/claim.entity';
import { PaymentStatus, PaymentType } from '../enums/payment.enum';

@Entity('payments')
export class Payment extends BaseEntity {
  @Column({ unique: true })
  @Index()
  transactionId: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  type: PaymentType;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number;

  @Column()
  currency: string;

  @ManyToOne(() => User, (user) => user.payments)
  user: User;

  @ManyToOne(() => Policy, (policy) => policy.payments)
  policy: Policy;

  @OneToOne(() => Claim, (claim) => claim.payment, { nullable: true })
  @JoinColumn()
  claim?: Claim;

  @Column({ nullable: true })
  paymentMethod?: string;

  @Column({ nullable: true })
  externalReference?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
