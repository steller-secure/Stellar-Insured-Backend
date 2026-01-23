import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { Claim } from './claim.entity';
import { ClaimStatus } from '../enums/claim-status.enum';

@Entity('claim_status_history')
export class ClaimStatusHistory extends BaseEntity {
  @ManyToOne(() => Claim, (claim) => claim.statusHistory)
  claim: Claim;

  @Column({
    type: 'enum',
    enum: ClaimStatus,
  })
  fromStatus: ClaimStatus;

  @Column({
    type: 'enum',
    enum: ClaimStatus,
  })
  toStatus: ClaimStatus;

  @Column({ nullable: true })
  reason?: string;

  @Column({ nullable: true })
  changedBy?: string;
}
