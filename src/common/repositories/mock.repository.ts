import { NotFoundException } from '@nestjs/common';
import { ISoftDeleteRepository, TransactionClient } from './repository.interface';

/**
 * In-memory mock repository for unit tests.
 *
 * Usage:
 *   const repo = new MockRepository<User>();
 *   repo.seed([{ id: '1', name: 'Alice' }]);
 *   const user = await repo.findById('1');
 *
 * Every method is a real async function backed by a simple Map, so tests
 * exercise the repository interface without any Prisma dependency.
 * Individual methods can also be replaced with jest.fn() for spy assertions.
 */
export class MockRepository<T extends { id: string }, ID = string>
  implements ISoftDeleteRepository<T, ID>
{
  protected store = new Map<string, T>();

  /** Pre-populate the store with seed records. */
  seed(records: T[]): this {
    for (const record of records) {
      this.store.set((record as any).id, record);
    }
    return this;
  }

  /** Clear all records. */
  clear(): void {
    this.store.clear();
  }

  /** Return a snapshot of all stored records. */
  all(): T[] {
    return Array.from(this.store.values());
  }

  async findById(id: ID, _tx?: TransactionClient): Promise<T | null> {
    return this.store.get(id as unknown as string) ?? null;
  }

  async findByIdOrFail(id: ID, tx?: TransactionClient): Promise<T> {
    const record = await this.findById(id, tx);
    if (!record) throw new NotFoundException(`Record with id ${id} not found`);
    return record;
  }

  async findMany(args: Record<string, unknown> = {}, _tx?: TransactionClient): Promise<T[]> {
    let records = Array.from(this.store.values());

    // Very basic where support for unit-test scenarios
    const where = (args.where ?? {}) as Record<string, unknown>;
    if (Object.keys(where).length > 0) {
      records = records.filter(r =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v),
      );
    }

    // skip / take
    const skip = (args.skip as number) ?? 0;
    const take = args.take as number | undefined;
    records = records.slice(skip, take !== undefined ? skip + take : undefined);

    return records;
  }

  async create(data: Record<string, unknown>, _tx?: TransactionClient): Promise<T> {
    const record = { ...data } as unknown as T;
    this.store.set((record as any).id, record);
    return record;
  }

  async update(id: ID, data: Record<string, unknown>, _tx?: TransactionClient): Promise<T> {
    const key = id as unknown as string;
    const existing = this.store.get(key);
    if (!existing) throw new NotFoundException(`Record with id ${key} not found`);
    const updated = { ...existing, ...data } as T;
    this.store.set(key, updated);
    return updated;
  }

  async delete(id: ID, _tx?: TransactionClient): Promise<T> {
    const key = id as unknown as string;
    const existing = this.store.get(key);
    if (!existing) throw new NotFoundException(`Record with id ${key} not found`);
    this.store.delete(key);
    return existing;
  }

  async softDelete(id: ID, tx?: TransactionClient): Promise<T> {
    return this.update(id, { deletedAt: new Date() }, tx);
  }

  async restore(id: ID, tx?: TransactionClient): Promise<T> {
    return this.update(id, { deletedAt: null }, tx);
  }

  async softDeleteMany(where: Record<string, unknown>, _tx?: TransactionClient): Promise<number> {
    let count = 0;
    for (const [key, record] of this.store.entries()) {
      if (Object.entries(where).every(([k, v]) => (record as any)[k] === v)) {
        this.store.set(key, { ...record, deletedAt: new Date() });
        count++;
      }
    }
    return count;
  }

  async count(where: Record<string, unknown> = {}, _tx?: TransactionClient): Promise<number> {
    if (Object.keys(where).length === 0) return this.store.size;
    return Array.from(this.store.values()).filter(r =>
      Object.entries(where).every(([k, v]) => (r as any)[k] === v),
    ).length;
  }

  /** Minimal transaction stub — runs the callback synchronously. */
  async transaction<R>(fn: (tx: TransactionClient) => Promise<R>): Promise<R> {
    return fn({} as TransactionClient);
  }
}
