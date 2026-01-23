import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/database/base.entity';
import { User } from './user.entity';

@Entity('user_portfolios')
export class UserPortfolio extends BaseEntity {
  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ default: 0 })
  activePoliciesCount: number;

  @Column({ default: 0 })
  totalClaimsSubmitted: number;

  @Column({ default: 0 })
  totalClaimsApproved: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  totalInvestedAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  totalReturns: number;
}
