import { Prisma } from '@prisma/client';
import {
  createSoftDeleteMiddleware,
  SOFT_DELETE_MODELS,
} from './prisma.soft-delete.middleware';

type MiddlewareParams = Prisma.MiddlewareParams;

function buildParams(overrides: Partial<MiddlewareParams>): MiddlewareParams {
  return {
    model: 'User',
    action: 'findMany',
    args: {},
    dataPath: [],
    runInTransaction: false,
    ...overrides,
  } as MiddlewareParams;
}

describe('createSoftDeleteMiddleware', () => {
  const middleware = createSoftDeleteMiddleware({ excludeDeleted: true });
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn().mockResolvedValue('result');
  });

  describe('model coverage', () => {
    it.each([
      'Notification',
      'NotificationSetting',
      'EmailOutbox',
      'IdempotencyKey',
      'IndexerLog',
    ])('includes %s in SOFT_DELETE_MODELS', model => {
      expect(SOFT_DELETE_MODELS).toContain(model);
    });

    it('covers every model defined in the Prisma schema', () => {
      expect([...SOFT_DELETE_MODELS].sort()).toEqual(
        [...Object.values(Prisma.ModelName)].sort(),
      );
    });

    it('leaves models outside the soft-delete list untouched', async () => {
      const params = buildParams({
        model: 'SomethingElse' as Prisma.ModelName,
        action: 'delete',
        args: { where: { id: '1' } },
      });

      await middleware(params, next);

      expect(next).toHaveBeenCalledWith(params);
      expect(next.mock.calls[0][0].action).toBe('delete');
    });
  });

  describe('read operations', () => {
    it('filters soft-deleted rows out of findMany by default', async () => {
      const params = buildParams({
        action: 'findMany',
        args: { where: { walletAddress: 'GABC' } },
      });

      await middleware(params, next);

      expect(next.mock.calls[0][0].args.where).toEqual({
        walletAddress: 'GABC',
        deletedAt: null,
      });
    });

    it('honours includeDeleted and strips the flag before the query runs', async () => {
      const params = buildParams({
        action: 'findMany',
        args: { where: { _includeDeleted: true } },
      });

      await middleware(params, next);

      expect(next.mock.calls[0][0].args.where).toEqual({});
    });

    it('filters soft-deleted rows out of count by default', async () => {
      const params = buildParams({ action: 'count', args: {} });

      await middleware(params, next);

      expect(next.mock.calls[0][0].args.where).toEqual({ deletedAt: null });
    });
  });

  describe('delete conversion', () => {
    it('converts delete into an update that stamps deletedAt', async () => {
      const params = buildParams({
        action: 'delete',
        args: { where: { id: 'user-1' } },
      });

      await middleware(params, next);

      const forwarded = next.mock.calls[0][0];
      expect(forwarded.action).toBe('update');
      expect(forwarded.args).toEqual({
        where: { id: 'user-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('converts deleteMany into updateMany scoped to active rows', async () => {
      const params = buildParams({
        model: 'Notification' as Prisma.ModelName,
        action: 'deleteMany',
        args: { where: { userId: 'user-1' } },
      });

      await middleware(params, next);

      const forwarded = next.mock.calls[0][0];
      expect(forwarded.action).toBe('updateMany');
      expect(forwarded.args).toEqual({
        where: { userId: 'user-1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('audited hard-delete escape hatch', () => {
    it('lets an explicit hardDelete flag through as a real delete', async () => {
      const params = buildParams({
        action: 'delete',
        args: { where: { id: 'user-1' }, hardDelete: true },
      });

      await middleware(params, next);

      const forwarded = next.mock.calls[0][0];
      expect(forwarded.action).toBe('delete');
      expect(forwarded.args).toEqual({ where: { id: 'user-1' } });
    });

    it('supports the _hardDelete flag inside where and strips it', async () => {
      const params = buildParams({
        model: 'ProcessedEvent' as Prisma.ModelName,
        action: 'deleteMany',
        args: { where: { network: 'testnet', _hardDelete: true } },
      });

      await middleware(params, next);

      const forwarded = next.mock.calls[0][0];
      expect(forwarded.action).toBe('deleteMany');
      expect(forwarded.args).toEqual({ where: { network: 'testnet' } });
    });
  });

  describe('update operations', () => {
    it('scopes regular updates to active rows', async () => {
      const params = buildParams({
        action: 'update',
        args: { where: { id: 'user-1' }, data: { email: 'a@b.c' } },
      });

      await middleware(params, next);

      expect(next.mock.calls[0][0].args.where).toEqual({
        id: 'user-1',
        deletedAt: null,
      });
    });

    it('allows restores (deletedAt: null) to reach soft-deleted rows', async () => {
      const params = buildParams({
        action: 'update',
        args: { where: { id: 'user-1' }, data: { deletedAt: null } },
      });

      await middleware(params, next);

      expect(next.mock.calls[0][0].args.where).toEqual({ id: 'user-1' });
    });
  });
});
