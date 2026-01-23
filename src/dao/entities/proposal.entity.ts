import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/database/base.entity';
import { User } from '../../modules/users/entities/user.entity';

@Entity('dao_proposals')
export class Proposal extends BaseEntity {
  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column()
  submitterWalletAddress: string;

  @Column({ default: 'draft' })
  status: 'draft' | 'active' | 'passed' | 'rejected' | 'executed';

  @Column({ nullable: true })
  votingStartDate?: Date | null;

  @Column({ nullable: true })
  votingEndDate?: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'submitter_id' })
  submitter: User;
}
