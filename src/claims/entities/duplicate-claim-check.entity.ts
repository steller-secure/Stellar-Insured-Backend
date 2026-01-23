import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('duplicate_claim_checks')
@Index(['claimId', 'potentialDuplicateId'])
@Index(['policyId', 'createdAt'])
export class DuplicateClaimCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  claimId: string;

  @Column('uuid')
  policyId: string;

  @Column('uuid')
  potentialDuplicateId: string;

  @Column('decimal', { precision: 5, scale: 2 })
  matchPercentage: number;

  @Column({
    type: 'enum',
    enum: ['AMOUNT_MATCH', 'DESCRIPTION_SIMILARITY', 'TEMPORAL_PROXIMITY', 'COMBINED'],
    default: 'COMBINED',
  })
  detectionMethod: string;

  @Column('boolean', { default: false })
  isFalsePositive: boolean;

  @Column('text', { nullable: true })
  adminNotes: string | null;

  @Column('uuid', { nullable: true })
  verifiedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column('timestamp', { nullable: true })
  resolvedAt: Date | null;
}
