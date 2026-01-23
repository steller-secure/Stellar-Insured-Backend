import { Controller, Get, Query } from '@nestjs/common';
import { TransactionService } from '../services/transaction.service';

/**
 * Transaction monitoring and audit controller
 * Provides endpoints for transaction logs and metrics
 */
@Controller('admin/transactions')
export class TransactionMonitorController {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Get transaction logs
   * Query params:
   *  - operationName: Filter by operation name (optional)
   */
  @Get('logs')
  getTransactionLogs(operationName?: string) {
    const logs = this.transactionService.getTransactionLogs(operationName);
    return {
      total: logs.length,
      logs: logs.map((log) => ({
        id: log.id,
        operationName: log.operationName,
        status: log.status,
        isolationLevel: log.isolationLevel,
        duration: log.duration,
        startTime: log.startTime,
        endTime: log.endTime,
        error: log.errorMessage,
        rollbackReason: log.rollbackReason,
      })),
    };
  }

  /**
   * Get transaction metrics
   * Query params:
   *  - operationName: Filter metrics by operation name (optional)
   */
  @Get('metrics')
  getTransactionMetrics(operationName?: string) {
    const metrics = this.transactionService.getTransactionMetrics(operationName);
    return {
      operationName: operationName || 'ALL',
      ...metrics,
    };
  }

  /**
   * Get health status based on transaction success rate
   */
  @Get('health')
  getTransactionHealth() {
    const metrics = this.transactionService.getTransactionMetrics();
    const isHealthy = metrics.successRate >= 95;

    return {
      status: isHealthy ? 'HEALTHY' : 'DEGRADED',
      successRate: `${metrics.successRate.toFixed(2)}%`,
      totalTransactions: metrics.total,
      failedTransactions: metrics.failed + metrics.rolledBack,
      averageExecutionTime: `${metrics.averageDuration.toFixed(2)}ms`,
    };
  }
}
