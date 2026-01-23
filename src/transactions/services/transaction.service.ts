import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  IsolationLevel,
  TransactionOptions,
  TransactionResult,
  TransactionLog,
} from '../types/transaction.types';

/**
 * Core transaction management service
 * Handles transaction lifecycle, error handling, and logging
 */
@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);
  private readonly transactionLogs: Map<string, TransactionLog> = new Map();

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute a function within a database transaction
   */
  async executeTransaction<T>(
    operationName: string,
    callback: (queryRunner: QueryRunner) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<TransactionResult<T>> {
    const transactionId = uuidv4();
    const startTime = new Date();
    let queryRunner: QueryRunner | null = null;
    let retries = 0;
    const maxRetries = options.retryCount ?? 3;
    const retryDelay = options.retryDelay ?? 1000;

    while (retries <= maxRetries) {
      queryRunner = this.dataSource.createQueryRunner();

      try {
        // Set isolation level
        const isolationLevel = options.isolationLevel || IsolationLevel.READ_COMMITTED;
        await this.setIsolationLevel(queryRunner, isolationLevel);

        // Start transaction
        await queryRunner.startTransaction(isolationLevel);
        this.logger.debug(`Transaction started: ${transactionId} for ${operationName}`);

        // Execute the business logic
        const result = await callback(queryRunner);

        // Commit transaction
        await queryRunner.commitTransaction();
        this.logger.log(`Transaction committed: ${transactionId} for ${operationName}`);

        // Log successful transaction
        this.logTransaction({
          id: transactionId,
          operationName,
          status: 'COMPLETED',
          isolationLevel,
          startTime,
          endTime: new Date(),
          duration: new Date().getTime() - startTime.getTime(),
        });

        return {
          success: true,
          data: result,
          executionTime: new Date().getTime() - startTime.getTime(),
        };
      } catch (error) {
        retries++;

        // Rollback on error
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
          this.logger.error(
            `Transaction rolled back: ${transactionId} for ${operationName}. Error: ${error.message}`,
          );

          this.logTransaction({
            id: transactionId,
            operationName,
            status: 'ROLLED_BACK',
            isolationLevel: options.isolationLevel || IsolationLevel.READ_COMMITTED,
            startTime,
            endTime: new Date(),
            duration: new Date().getTime() - startTime.getTime(),
            errorMessage: error.message,
          });
        }

        // Retry logic for transient failures
        if (retries <= maxRetries && this.isTransientError(error)) {
          this.logger.warn(
            `Retrying transaction ${transactionId} (attempt ${retries}/${maxRetries}) after ${retryDelay}ms`,
          );
          await this.delay(retryDelay);
          continue;
        }

        return {
          success: false,
          error,
          executionTime: new Date().getTime() - startTime.getTime(),
        };
      } finally {
        // Release the query runner
        if (queryRunner && !queryRunner.isReleased) {
          await queryRunner.release();
        }
      }
    }

    return {
      success: false,
      error: new Error(
        `Transaction failed after ${maxRetries} retries for operation: ${operationName}`,
      ),
      executionTime: new Date().getTime() - startTime.getTime(),
    };
  }

  /**
   * Execute multiple operations within a single transaction
   */
  async executeCompositeTransaction<T>(
    operationName: string,
    operations: Array<(queryRunner: QueryRunner) => Promise<any>>,
    options: TransactionOptions = {},
  ): Promise<TransactionResult<T[]>> {
    return this.executeTransaction(
      operationName,
      async (queryRunner) => {
        const results: any[] = [];
        for (const operation of operations) {
          results.push(await operation(queryRunner));
        }
        return results as T[];
      },
      options,
    );
  }

  /**
   * Manual rollback trigger for business logic failures
   */
  async manualRollback(
    queryRunner: QueryRunner,
    reason: string,
  ): Promise<void> {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
      this.logger.warn(`Manual rollback triggered: ${reason}`);

      this.logTransaction({
        id: uuidv4(),
        operationName: 'MANUAL_ROLLBACK',
        status: 'ROLLED_BACK',
        isolationLevel: IsolationLevel.READ_COMMITTED,
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        rollbackReason: reason,
      });
    }
  }

  /**
   * Get transaction logs (for monitoring and auditing)
   */
  getTransactionLogs(operationName?: string): TransactionLog[] {
    if (operationName) {
      return Array.from(this.transactionLogs.values()).filter(
        (log) => log.operationName === operationName,
      );
    }
    return Array.from(this.transactionLogs.values());
  }

  /**
   * Get transaction metrics
   */
  getTransactionMetrics(operationName?: string) {
    const logs = this.getTransactionLogs(operationName);
    const completed = logs.filter((log) => log.status === 'COMPLETED').length;
    const rolledBack = logs.filter((log) => log.status === 'ROLLED_BACK').length;
    const failed = logs.filter((log) => log.status === 'FAILED').length;
    const avgDuration =
      logs.reduce((sum, log) => sum + log.duration, 0) / (logs.length || 1);

    return {
      total: logs.length,
      completed,
      rolledBack,
      failed,
      successRate: logs.length > 0 ? (completed / logs.length) * 100 : 0,
      averageDuration: avgDuration,
    };
  }

  /**
   * Private helper: Set isolation level
   */
  private async setIsolationLevel(
    queryRunner: QueryRunner,
    isolationLevel: IsolationLevel,
  ): Promise<void> {
    try {
      await queryRunner.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    } catch (error) {
      this.logger.warn(`Failed to set isolation level: ${error.message}`);
    }
  }

  /**
   * Private helper: Determine if error is transient
   */
  private isTransientError(error: any): boolean {
    const transientErrors = [
      'deadlock detected',
      'connection timeout',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
    ];
    return transientErrors.some((msg) =>
      error.message?.toLowerCase().includes(msg.toLowerCase()),
    );
  }

  /**
   * Private helper: Sleep utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Private helper: Log transaction
   */
  private logTransaction(log: TransactionLog): void {
    this.transactionLogs.set(log.id, log);

    // Keep only last 1000 transactions to prevent memory leak
    if (this.transactionLogs.size > 1000) {
      const firstKey = this.transactionLogs.keys().next().value;
      this.transactionLogs.delete(firstKey);
    }
  }
}
