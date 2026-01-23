import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Proposal } from './proposal.entity';
import { VoteType } from '../enums/vote-type.enum';

@Entity('votes')
@Unique(['proposalId', 'walletAddress']) // Enforce one-wallet-one-vote per proposal
export class Vote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'proposal_id' })
  @Index()
  proposalId: string;

  @ManyToOne(() => Proposal, proposal => proposal.votes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'proposal_id' })
  proposal: Proposal;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User, user => user.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'wallet_address', length: 56 })
  @Index()
  walletAddress: string;

  @Column({
    name: 'vote_type',
    type: 'enum',
    enum: VoteType,
  })
  voteType: VoteType;

  @Column({ name: 'transaction_hash', nullable: true })
  transactionHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
