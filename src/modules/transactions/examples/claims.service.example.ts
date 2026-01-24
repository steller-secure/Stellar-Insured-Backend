import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { QueryRunner } from 'typeorm'; // Separate the type import
import { FinancialOperationsService } from '../services/financial-operations.service';
import { Transactional } from '../decorators/transactional.decorator';
import { IsolationLevel, TransactionOptions } from '../types/transaction.types';

/**
 * Example: Claims Service using Transaction Management
 * Demonstrates how to integrate the transaction management module
 * into your existing NestJS services
 */
@Injectable()
export class ClaimsServiceExample {
  constructor(
    private readonly financialOperationsService: FinancialOperationsService,
    private readonly dataSource: DataSource, // Inject DataSource for fallback
  ) {}

  /**
   * Example 1: Using the financial operations service directly
   */
  async submitClaimExample(
    claimData: { amount: number; description: string },
    policyId: string,
    userId: string,
  ) {
    try {
      const result = await this.financialOperationsService.submitClaim(
        claimData,
        policyId,
        userId,
      );

      if (!result.success) {
        throw result.error;
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Example 2: Using the @Transactional decorator
   */
  @Transactional({
    isolationLevel: IsolationLevel.READ_COMMITTED,
    retryCount: 3,
    retryDelay: 500,
  })
  async approveClaimWithDecorator(
    claimId: string,
    amount: number,
    approvedBy: string,
    queryRunner?: QueryRunner,
  ) {
    // FIXED: Use the queryRunner's manager if it exists, otherwise fallback to the global manager
    // This ensures 'manager' is never undefined
    const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;

    // Example operations
    await manager.query(
      `UPDATE claims 
       SET status = $1, approved_amount = $2, approved_at = NOW()
       WHERE id = $3
       RETURNING *`,
      ['APPROVED', amount, claimId],
    );

    return {
      claimId,
      approvedAmount: amount,
      status: 'APPROVED',
    };
  }

  /**
   * Example 3: Handling composite operations
   */
  async processClaimApprovalWithComposite(
    claimId: string,
    approvalAmount: number,
    approvedBy: string,
    userId: string,
  ) {
    const operations = [
      async (qr: QueryRunner) => {
        const manager = qr.manager;
        return manager.query(
          `UPDATE claims SET status = $1, approved_amount = $2 WHERE id = $3 RETURNING *`,
          ['APPROVED', approvalAmount, claimId],
        );
      },
      async (qr: QueryRunner) => {
        const manager = qr.manager;
        return manager.query(
          `INSERT INTO payments (claim_id, amount, status, created_at) 
            VALUES ($1, $2, $3, NOW()) 
            RETURNING *`,
          [claimId, approvalAmount, 'PENDING'],
        );
      },
      async (qr: QueryRunner) => {
        const manager = qr.manager;
        return manager.query(
          `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING *`,
          [approvalAmount, userId],
        );
      },
    ];

    return operations; 
  }

  /**
   * Example 4: Manual rollback for business logic failures
   */
  async approveClaimWithManualRollback(
    claimId: string,
    approvalAmount: number,
    maxAllowedAmount: number,
    transactionService: any,
  ) {
    const result = await transactionService.executeTransaction(
      'CLAIM_APPROVAL_WITH_VALIDATION',
      async (queryRunner: QueryRunner) => {
        const manager = queryRunner.manager;

        const claim = await manager.query(
          `SELECT * FROM claims WHERE id = $1 FOR UPDATE`,
          [claimId],
        );

        if (approvalAmount > maxAllowedAmount) {
          await transactionService.manualRollback(
            queryRunner,
            `Approval amount ${approvalAmount} exceeds maximum allowed ${maxAllowedAmount}`,
          );

          throw new Error('Approval amount exceeds maximum allowed');
        }

        return manager.query(
          `UPDATE claims SET status = $1, approved_amount = $2 WHERE id = $3 RETURNING *`,
          ['APPROVED', approvalAmount, claimId],
        );
      },
      {
        isolationLevel: IsolationLevel.READ_COMMITTED,
        retryCount: 2,
        retryDelay: 500,
      },
    );

    return result;
  }

  /**
   * Example 5: Monitoring and auditing transactions
   */
  async getTransactionMetrics(
    transactionService: any, 
  ) {
    const metrics = transactionService.getTransactionMetrics('CLAIM_SUBMISSION');
    const logs = transactionService.getTransactionLogs('CLAIM_APPROVAL');

    return {
      metrics,
      recentLogs: logs.slice(-10),
    };
  }
}