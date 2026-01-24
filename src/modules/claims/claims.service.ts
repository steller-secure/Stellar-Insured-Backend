import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Claim } from './entities/claim.entity';
import {
  EventNames,
  ClaimSubmittedEvent,
  ClaimApprovedEvent,
  ClaimRejectedEvent,
  ClaimSettledEvent,
} from '../../events';

/**
 * ClaimsService handles claim lifecycle operations.
 */
@Injectable()
export class ClaimsService {
  constructor(
    @InjectRepository(Claim)
    private readonly claimsRepository: Repository<Claim>, 
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Submit a new claim.
   */
  submitClaim(
    claimId: string,
    userId: string,
    policyId: string,
    amount: number, // <--- Added amount
  ): { claimId: string; status: string } {
    // In a real app, you would save to DB here:
    // const newClaim = this.claimsRepository.create({ ... });
    // await this.claimsRepository.save(newClaim);

    this.eventEmitter.emit(
      EventNames.CLAIM_SUBMITTED,
      new ClaimSubmittedEvent(claimId, userId, policyId, amount), // <--- Pass amount
    );

    return { claimId, status: 'submitted' };
  }

  /**
   * Approve a claim.
   */
  approveClaim(
    claimId: string, 
    userId: string, 
    approvedBy: string,   // <--- Added admin ID
    approvalAmount: number // <--- Added amount
  ): { claimId: string; status: string } {
    this.eventEmitter.emit(
      EventNames.CLAIM_APPROVED,
      new ClaimApprovedEvent(claimId, userId, approvedBy, approvalAmount),
    );
    return { claimId, status: 'approved' };
  }

  /**
   * Reject a claim.
   */
  rejectClaim(
    claimId: string, 
    userId: string, 
    rejectedBy: string, // <--- Added admin ID
    reason: string
  ): { claimId: string; status: string } {
    this.eventEmitter.emit(
      EventNames.CLAIM_REJECTED,
      new ClaimRejectedEvent(claimId, userId, rejectedBy, reason),
    );
    return { claimId, status: 'rejected' };
  }

  /**
   * Settle a claim.
   */
  settleClaim(
    claimId: string, 
    userId: string, 
    amount: number, 
    settledBy: string // <--- Added admin ID
  ): { claimId: string; status: string } {
    this.eventEmitter.emit(
      EventNames.CLAIM_SETTLED,
      new ClaimSettledEvent(claimId, userId, amount, settledBy),
    );
    return { claimId, status: 'settled' };
  }

  /**
   * Dashboard Statistics
   */
  async getUserStats(walletAddress: string) {
    // 1. Count Pending Claims
    const pendingCount = await this.claimsRepository.count({
      where: { 
        // Relationship check: user ID is inside the 'user' relation object
        user: { id: walletAddress } as any, 
        status: 'PENDING' as any 
      }
    });

    // 2. Count Settled Claims
    const settledCount = await this.claimsRepository.count({
      where: { 
        user: { id: walletAddress } as any, 
        status: 'SETTLED' as any 
      }
    });

    return { pendingCount, settledCount };
  }
}