import { Entity, Column, ManyToOne, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { User } from '../../users/entities/user.entity';
import { PolicyStatus } from '../enums/policy-status.enum';
import { PolicyStatusHistory } from './policy-status-history.entity';
import { Claim } from '../../claims/entities/claim.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('policies')
export class Policy extends BaseEntity {
  @Column({ unique: true })
  @Index()
  policyNumber: string;

  @Column({
    type: 'enum',
    enum: PolicyStatus,
    default: PolicyStatus.DRAFT,
  })
  status: PolicyStatus;

  @Column()
  coverageType: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  premium: number;

  @ManyToOne(() => User, (user) => user.policies)
  user: User;

  @OneToMany(() => PolicyStatusHistory, (history) => history.policy)
  statusHistory: PolicyStatusHistory[];

  @OneToMany(() => Claim, (claim) => claim.policy)
  claims: Claim[];

  @OneToMany(() => Payment, (payment) => payment.policy)
  payments: Payment[];
}
