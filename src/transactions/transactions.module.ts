import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionService } from './services/transaction.service';
import { FinancialOperationsService } from './services/financial-operations.service';
import { TransactionMonitorController } from './controllers/transaction-monitor.controller';

/**
 * Transaction Management Module
 * Provides comprehensive transaction management for critical operations
 */
@Module({
  imports: [TypeOrmModule],
  providers: [TransactionService, FinancialOperationsService],
  controllers: [TransactionMonitorController],
  exports: [TransactionService, FinancialOperationsService],
})
export class TransactionsModule {}
