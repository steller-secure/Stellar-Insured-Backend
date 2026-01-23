import { Inject } from '@nestjs/common';
import { TransactionService } from '../services/transaction.service';
import { IsolationLevel, TransactionOptions } from '../types/transaction.types';

/**
 * Decorator for automatic transaction management
 * Wraps method execution in a database transaction
 */
export function Transactional(options: TransactionOptions = {}) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Inject TransactionService via reflection or dependency injection
      const transactionService: TransactionService = this.transactionService;

      if (!transactionService) {
        throw new Error(
          'TransactionService not injected. Ensure the class has transactionService property.',
        );
      }

      const operationName = `${target.constructor.name}.${String(propertyKey)}`;

      // Execute method within transaction
      const result = await transactionService.executeTransaction(
        operationName,
        async (queryRunner) => {
          // Pass queryRunner as additional argument to the method
          return originalMethod.apply(this, [...args, queryRunner]);
        },
        options,
      );

      if (!result.success) {
        throw result.error;
      }

      return result.data;
    };

    return descriptor;
  };
}

/**
 * Inject TransactionService into a service or controller
 */
export function InjectTransactionService() {
  return Inject(TransactionService);
}
