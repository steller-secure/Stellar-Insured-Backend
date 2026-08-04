import { Prisma } from '@prisma/client';

/**
 * A Prisma transaction client or the root PrismaService – anything that
 * exposes the model delegates.  Repositories accept this so callers can
 * enlist them in an existing transaction.
 */
export type TransactionClient = Prisma.TransactionClient;

/**
 * Generic read/write repository interface.
 * T  = the Prisma model type (e.g. User, InsurancePolicy)
 * ID = the primary-key type (defaults to string)
 */
export interface IRepository<T, ID = string> {
  findById(id: ID, tx?: TransactionClient): Promise<T | null>;
  findMany(args?: Record<string, unknown>, tx?: TransactionClient): Promise<T[]>;
  create(data: Record<string, unknown>, tx?: TransactionClient): Promise<T>;
  update(id: ID, data: Record<string, unknown>, tx?: TransactionClient): Promise<T>;
  delete(id: ID, tx?: TransactionClient): Promise<T>;
}

/**
 * Extends IRepository with soft-delete helpers.
 */
export interface ISoftDeleteRepository<T, ID = string> extends IRepository<T, ID> {
  softDelete(id: ID, tx?: TransactionClient): Promise<T>;
  restore(id: ID, tx?: TransactionClient): Promise<T>;
}
