import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { TransactionService } from './transaction.service';
import { IsolationLevel, TransactionOptions } from '../types/transaction.types';

/**
 * Financial operations service
 * Implements critical financial transactions with proper ACID compliance
 */
@Injectable()
export class FinancialOperationsService {
  private readonly logger = new Logger(FinancialOperationsService.name);

  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Claim Submission Transaction
   * Creates a new claim and updates policy limits atomically
   */
  async submitClaim(
    claimData: any,
    policyId: string,
    userId: string,
  ): Promise<any> {
    const options: TransactionOptions = {
      isolationLevel: IsolationLevel.READ_COMMITTED,
      retryCount: 3,
      retryDelay: 500,
    };

    return this.transactionService.executeTransaction(
      'CLAIM_SUBMISSION',
      async (queryRunner) => {
        const manager = queryRunner.manager;

        try {
          // Step 1: Verify policy exists and is active
          const policy = await manager.query(
            `SELECT * FROM policies WHERE id = $1 FOR UPDATE`,
            [policyId],
          );

          if (!policy || policy.length === 0) {
            throw new Error(`Policy ${policyId} not found`);
          }

          if (policy[0].status !== 'ACTIVE') {
            throw new Error(`Policy is not active: ${policy[0].status}`);
          }

          // Step 2: Create claim record
          const claimResult = await manager.query(
            `INSERT INTO claims (policy_id, user_id, amount, status, created_at) 
             VALUES ($1, $2, $3, $4, NOW()) 
             RETURNING *`,
            [policyId, userId, claimData.amount, 'PENDING'],
          );

          const claim = claimResult[0];
          this.logger.log(`Claim created: ${claim.id} for policy ${policyId}`);

          // Step 3: Update policy claim limit
          const updatedPolicy = await manager.query(
            `UPDATE policies 
             SET remaining_claims = remaining_claims - 1,
                 last_claim_date = NOW()
             WHERE id = $1
             RETURNING *`,
            [policyId],
          );

          if (updatedPolicy[0].remaining_claims < 0) {
            await this.transactionService.manualRollback(
              queryRunner,
              'Policy claim limit exceeded',
            );
            throw new Error('Policy claim limit exceeded');
          }

          this.logger.log(`Policy limits updated for ${policyId}`);

          return {
            claimId: claim.id,
            status: 'SUBMITTED',
            remainingClaims: updatedPolicy[0].remaining_claims,
          };
        } catch (error) {
          this.logger.error(`Claim submission failed: ${error.message}`);
          throw error;
        }
      },
      options,
    );
  }

  /**
   * Claim Approval Transaction
   * Approves claim, updates status, creates payment record, and updates user balance
   */
  async approveClaim(
    claimId: string,
    approvalData: { amount: number; approvedBy: string },
  ): Promise<any> {
    const options: TransactionOptions = {
      isolationLevel: IsolationLevel.READ_COMMITTED,
      retryCount: 3,
      retryDelay: 500,
    };

    return this.transactionService.executeTransaction(
      'CLAIM_APPROVAL',
      async (queryRunner) => {
        const manager = queryRunner.manager;

        try {
          // Step 1: Get claim with lock
          const claim = await manager.query(
            `SELECT * FROM claims WHERE id = $1 FOR UPDATE`,
            [claimId],
          );

          if (!claim || claim.length === 0) {
            throw new Error(`Claim ${claimId} not found`);
          }

          // Step 2: Update claim status
          const updatedClaim = await manager.query(
            `UPDATE claims 
             SET status = $1, approved_amount = $2, approved_at = NOW(), approved_by = $3
             WHERE id = $4
             RETURNING *`,
            ['APPROVED', approvalData.amount, approvalData.approvedBy, claimId],
          );

          this.logger.log(`Claim approved: ${claimId}`);

          // Step 3: Create payment record
          const paymentResult = await manager.query(
            `INSERT INTO payments (claim_id, amount, status, created_at) 
             VALUES ($1, $2, $3, NOW()) 
             RETURNING *`,
            [claimId, approvalData.amount, 'PENDING'],
          );

          const payment = paymentResult[0];
          this.logger.log(`Payment record created: ${payment.id}`);

          // Step 4: Update user balance
          const userUpdate = await manager.query(
            `UPDATE users 
             SET balance = balance + $1, updated_at = NOW()
             WHERE id = (SELECT user_id FROM claims WHERE id = $2)
             RETURNING *`,
            [approvalData.amount, claimId],
          );

          this.logger.log(`User balance updated for claim ${claimId}`);

          return {
            claimId,
            paymentId: payment.id,
            status: 'APPROVED',
            approvedAmount: approvalData.amount,
            userBalance: userUpdate[0].balance,
          };
        } catch (error) {
          this.logger.error(`Claim approval failed: ${error.message}`);
          throw error;
        }
      },
      options,
    );
  }

  /**
   * Policy Purchase Transaction
   * Creates policy, deducts payment, and creates invoice
   */
  async purchasePolicy(
    policyData: any,
    userId: string,
    paymentAmount: number,
  ): Promise<any> {
    const options: TransactionOptions = {
      isolationLevel: IsolationLevel.READ_COMMITTED,
      retryCount: 3,
      retryDelay: 500,
    };

    return this.transactionService.executeTransaction(
      'POLICY_PURCHASE',
      async (queryRunner) => {
        const manager = queryRunner.manager;

        try {
          // Step 1: Verify user has sufficient balance
          const user = await manager.query(
            `SELECT * FROM users WHERE id = $1 FOR UPDATE`,
            [userId],
          );

          if (!user || user.length === 0) {
            throw new Error(`User ${userId} not found`);
          }

          if (user[0].balance < paymentAmount) {
            throw new Error('Insufficient balance for policy purchase');
          }

          // Step 2: Create policy record
          const policyResult = await manager.query(
            `INSERT INTO policies (user_id, name, premium, remaining_claims, status, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW()) 
             RETURNING *`,
            [userId, policyData.name, policyData.premium, policyData.claimsPerYear, 'ACTIVE'],
          );

          const policy = policyResult[0];
          this.logger.log(`Policy created: ${policy.id} for user ${userId}`);

          // Step 3: Deduct payment from user balance
          const updatedUser = await manager.query(
            `UPDATE users 
             SET balance = balance - $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [paymentAmount, userId],
          );

          if (updatedUser[0].balance < 0) {
            await this.transactionService.manualRollback(
              queryRunner,
              'Insufficient balance after payment deduction',
            );
            throw new Error('Balance inconsistency detected');
          }

          this.logger.log(`Payment deducted from user ${userId}`);

          // Step 4: Create invoice record
          const invoiceResult = await manager.query(
            `INSERT INTO invoices (policy_id, user_id, amount, status, created_at) 
             VALUES ($1, $2, $3, $4, NOW()) 
             RETURNING *`,
            [policy.id, userId, paymentAmount, 'PAID'],
          );

          const invoice = invoiceResult[0];
          this.logger.log(`Invoice created: ${invoice.id}`);

          return {
            policyId: policy.id,
            invoiceId: invoice.id,
            status: 'PURCHASED',
            paidAmount: paymentAmount,
            remainingBalance: updatedUser[0].balance,
          };
        } catch (error) {
          this.logger.error(`Policy purchase failed: ${error.message}`);
          throw error;
        }
      },
      options,
    );
  }

  /**
   * Policy Cancellation Transaction
   * Updates policy status, calculates refund, and creates refund record
   */
  async cancelPolicy(policyId: string, userId: string): Promise<any> {
    const options: TransactionOptions = {
      isolationLevel: IsolationLevel.READ_COMMITTED,
      retryCount: 3,
      retryDelay: 500,
    };

    return this.transactionService.executeTransaction(
      'POLICY_CANCELLATION',
      async (queryRunner) => {
        const manager = queryRunner.manager;

        try {
          // Step 1: Get policy with lock
          const policy = await manager.query(
            `SELECT * FROM policies WHERE id = $1 AND user_id = $2 FOR UPDATE`,
            [policyId, userId],
          );

          if (!policy || policy.length === 0) {
            throw new Error(`Policy ${policyId} not found for user ${userId}`);
          }

          if (policy[0].status === 'CANCELLED') {
            throw new Error('Policy is already cancelled');
          }

          // Step 2: Update policy status
          await manager.query(
            `UPDATE policies 
             SET status = $1, cancelled_at = NOW()
             WHERE id = $2`,
            ['CANCELLED', policyId],
          );

          this.logger.log(`Policy cancelled: ${policyId}`);

          // Step 3: Calculate refund (pro-rata based on remaining coverage)
          const refundAmount = await this.calculateRefund(
            policy[0].premium,
            policy[0].created_at,
          );

          // Step 4: Create refund record
          const refundResult = await manager.query(
            `INSERT INTO refunds (policy_id, user_id, amount, status, created_at) 
             VALUES ($1, $2, $3, $4, NOW()) 
             RETURNING *`,
            [policyId, userId, refundAmount, 'PENDING'],
          );

          const refund = refundResult[0];
          this.logger.log(`Refund record created: ${refund.id}`);

          // Step 5: Update user balance with refund
          const updatedUser = await manager.query(
            `UPDATE users 
             SET balance = balance + $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [refundAmount, userId],
          );

          this.logger.log(`Refund applied to user ${userId}`);

          return {
            policyId,
            refundId: refund.id,
            status: 'CANCELLED',
            refundAmount,
            newBalance: updatedUser[0].balance,
          };
        } catch (error) {
          this.logger.error(`Policy cancellation failed: ${error.message}`);
          throw error;
        }
      },
      options,
    );
  }

  /**
   * Private helper: Calculate pro-rata refund
   */
  private async calculateRefund(premium: number, policyCreatedDate: Date): Promise<number> {
    const now = new Date();
    const created = new Date(policyCreatedDate);
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - created.getTime();
    const remaining = Math.max(0, (oneYear - elapsed) / oneYear);

    return Math.round(premium * remaining * 100) / 100;
  }
}
