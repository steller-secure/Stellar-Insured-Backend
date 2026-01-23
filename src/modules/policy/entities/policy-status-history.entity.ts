import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { Policy } from './policy.entity';
import { PolicyStatus } from '../enums/policy-status.enum';

@Entity('policy_status_history')
export class PolicyStatusHistory extends BaseEntity {
  @ManyToOne(() => Policy, (policy) => policy.statusHistory)
  policy: Policy;

  @Column({
    type: 'enum',
    enum: PolicyStatus,
  })
  fromStatus: PolicyStatus;

  @Column({
    type: 'enum',
    enum: PolicyStatus,
  })
  toStatus: PolicyStatus;

  @Column({ nullable: true })
  reason?: string;

  @Column({ nullable: true })
  changedBy?: string;
}
