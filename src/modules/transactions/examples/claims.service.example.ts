import { Injectable } from '@nestjs/common';
// FIX: Use 'import type' for QueryRunner to avoid TS1272
import type { QueryRunner } from 'typeorm'; 
import { FinancialOperationsService } from '../services/financial-operations.service';
import { Transactional } from '../decorators/transactional.decorator';
import { IsolationLevel, TransactionOptions } from '../types/transaction.types';

// ... rest of the file remains exactly the same
/**
 * Example: Claims Service using Transaction Management
 * Demonstrates how to integrate the transaction management module
 * into your existing NestJS services
 */
@Injectable()
export class ClaimsServiceExample {
  constructor(
    private readonly financialOperationsService: FinancialOperationsService,
  ) {}

  /**
   * Example 1: Using the financial operations service directly
   * This method encapsulates claim submission logic with full transaction support
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
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Example 2: Using the @Transactional decorator
   * For methods that need to be wrapped in a transaction automatically
   *
   * Note: The transactionService must be injected in the class:
   * constructor(private readonly transactionService: TransactionService) {}
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
    // The queryRunner is passed automatically by the decorator
    // Use it to perform database operations within the transaction
    const manager = queryRunner!.manager;

    // Example operations
    const updatedClaim = await manager.query(
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
   * Multiple database operations that must succeed together or fail together
   */
  async processClaimApprovalWithComposite(
    claimId: string,
    approvalAmount: number,
    approvedBy: string,
    userId: string,
  ) {
    // This pattern uses executeCompositeTransaction from TransactionService
    // to execute multiple operations atomically

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

    const options: TransactionOptions = {
      isolationLevel: IsolationLevel.READ_COMMITTED,
      retryCount: 3,
      retryDelay: 500,
    };

    // Execute all operations as a single transaction
    // They will either all succeed or all be rolled back
    return operations; // In real usage, pass to executeCompositeTransaction
  }

  /**
   * Example 4: Manual rollback for business logic failures
   * When certain business conditions aren't met
   */
  async approveClaimWithManualRollback(
    claimId: string,
    approvalAmount: number,
    maxAllowedAmount: number,
    transactionService: any, // Injected TransactionService
  ) {
    // This pattern allows you to manually rollback if business logic fails
    // even if the database operations themselves were successful

    const result = await transactionService.executeTransaction(
      'CLAIM_APPROVAL_WITH_VALIDATION',
      async (queryRunner) => {
        const manager = queryRunner.manager;

        // Get claim
        const claim = await manager.query(
          `SELECT * FROM claims WHERE id = $1 FOR UPDATE`,
          [claimId],
        );

        // Business logic: Validate approval amount
        if (approvalAmount > maxAllowedAmount) {
          // Trigger manual rollback
          await transactionService.manualRollback(
            queryRunner,
            `Approval amount ${approvalAmount} exceeds maximum allowed ${maxAllowedAmount}`,
          );

          throw new Error('Approval amount exceeds maximum allowed');
        }

        // Update claim
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
   * Access transaction logs and metrics (via TransactionService)
   */
  async getTransactionMetrics(
    transactionService: any, // Injected TransactionService
  ) {
    // Get metrics for all claim-related transactions
    const metrics = transactionService.getTransactionMetrics('CLAIM_SUBMISSION');

    // Get all transaction logs
    const logs = transactionService.getTransactionLogs('CLAIM_APPROVAL');

    return {
      metrics,
      recentLogs: logs.slice(-10), // Last 10 transactions
    };
  }
}

/**
 * Usage Examples in a Controller
 *
 * @Controller('claims')
 * export class ClaimsController {
 *   constructor(private readonly claimsService: ClaimsServiceExample) {}
 *
 *   @Post('submit')
 *   async submitClaim(
 *     @Body() claimData: { amount: number; description: string },
 *     @Query('policyId') policyId: string,
 *     @Query('userId') userId: string,
 *   ) {
 *     return this.claimsService.submitClaimExample(claimData, policyId, userId);
 *   }
 *
 *   @Post('approve')
 *   async approveClaim(
 *     @Body() body: { claimId: string; amount: number; approvedBy: string },
 *   ) {
 *     return this.claimsService.approveClaimWithDecorator(
 *       body.claimId,
 *       body.amount,
 *       body.approvedBy,
 *     );
 *   }
 *
 *   @Get('metrics')
 *   async getMetrics() {
 *     return this.claimsService.getTransactionMetrics();
 *   }
 * }
 */
