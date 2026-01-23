/**
 * Transaction management types and enums
 */

export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface TransactionContext {
  queryRunner: any;
  isActive: boolean;
  startTime: Date;
  operationName: string;
}

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  rollbackReason?: string;
  executionTime: number;
}

export interface TransactionLog {
  id: string;
  operationName: string;
  status: 'STARTED' | 'COMPLETED' | 'ROLLED_BACK' | 'FAILED';
  isolationLevel: IsolationLevel;
  startTime: Date;
  endTime: Date;
  duration: number;
  errorMessage?: string;
  rollbackReason?: string;
}
