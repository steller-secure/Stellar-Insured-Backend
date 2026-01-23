import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ClaimStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum ClaimType {
  ACCIDENT = 'ACCIDENT',
  THEFT = 'THEFT',
  WEATHER_DAMAGE = 'WEATHER_DAMAGE',
  MECHANICAL_FAILURE = 'MECHANICAL_FAILURE',
  OTHER = 'OTHER',
}

@Entity('claims')
@Index(['userId', 'policyId'])
@Index(['policyId', 'incidentDate', 'status'])
@Index(['userId', 'createdAt'])
export class Claim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  policyId: string;

  @Column({
    type: 'enum',
    enum: ClaimStatus,
    default: ClaimStatus.SUBMITTED,
  })
  status: ClaimStatus;

  @Column({
    type: 'enum',
    enum: ClaimType,
  })
  claimType: ClaimType;

  @Column('date')
  incidentDate: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  claimAmount: number;

  @Column('text')
  description: string;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @Column('uuid', { nullable: true })
  duplicateOfId: string | null;

  @Column('boolean', { default: false })
  flaggedForManualReview: boolean;

  @Column('text', { nullable: true })
  rejectionReason: string | null;

  @Column('text', { nullable: true })
  approvalNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('timestamp', { nullable: true })
  reviewedAt: Date | null;

  @Column('uuid', { nullable: true })
  reviewedBy: string | null;
}
