import { PrismaService } from '../../prisma.service';
import { ISoftDeleteRepository, TransactionClient } from './repository.interface';
import { BaseRepository } from './base.repository';

/**
 * Extends BaseRepository with explicit soft-delete / restore helpers.
 *
 * The PrismaService already registers soft-delete middleware that converts
 * `delete` operations into `UPDATE … SET deleted_at = NOW()`, so most
 * callers never need to call `softDelete` directly.  This class exists for
 * the rare cases where a service needs to *explicitly* stamp `deletedAt` on
 * a batch of rows (e.g. cascade soft-delete) or restore a record.
 */
export abstract class SoftDeleteRepository<T, ID = string>
  extends BaseRepository<T, ID>
  implements ISoftDeleteRepository<T, ID>
{
  constructor(prisma: PrismaService, modelName: string) {
    super(prisma, modelName);
  }

  /**
   * Explicit soft-delete: stamps `deletedAt` on a single record.
   * Prefer the standard `delete()` method (handled by middleware) unless you
   * need fine-grained control over the timestamp.
   */
  async softDelete(id: ID, tx?: TransactionClient): Promise<T> {
    return this.delegate(tx).update({
      where: { id },
      data: { deletedAt: new Date() },
    }) as Promise<T>;
  }

  /**
   * Restore a soft-deleted record by clearing `deletedAt`.
   * Note: the soft-delete middleware filters deleted rows, so this query uses
   * `updateMany` with `includeDeleted: true` semantics via raw access.
   */
  async restore(id: ID, tx?: TransactionClient): Promise<T> {
    // We bypass the soft-delete middleware by using updateMany with the
    // raw where clause; the middleware only intercepts `update` with a
    // unique where, not `updateMany`.
    const results = await this.delegate(tx).updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (results.count === 0) {
      const record = await this.delegate(tx).findUnique({ where: { id } });
      return record as T;
    }
    return this.delegate(tx).findUnique({ where: { id } }) as Promise<T>;
  }

  /**
   * Soft-delete multiple records matching a where clause in one statement.
   */
  async softDeleteMany(where: Record<string, unknown>, tx?: TransactionClient): Promise<number> {
    const result = await this.delegate(tx).updateMany({
      where,
      data: { deletedAt: new Date() },
    });
    return result.count as number;
  }
}
