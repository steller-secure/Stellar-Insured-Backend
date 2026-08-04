import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseTransformInterceptor } from './response.interceptor';
import {
  getTracingContext,
  runWithTracingContext,
} from '../tracing/tracing-context';

describe('ResponseTransformInterceptor', () => {
  const interceptor = new ResponseTransformInterceptor();
  const context = {} as ExecutionContext;

  const run = (body: unknown) =>
    firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of(body),
      } as CallHandler),
    );

  function buildHttpContext(options: {
    user?: { id?: string };
    params?: Record<string, string>;
  }) {
    const setHeader = jest.fn();
    const request = { user: options.user, params: options.params };
    const response = { setHeader };
    const httpContext = {
      getRequest: () => request,
      getResponse: () => response,
    };
    const execContext = {
      switchToHttp: () => httpContext,
    } as unknown as ExecutionContext;

    return { execContext, setHeader };
  }

  it('wraps plain payloads in the success envelope', async () => {
    await expect(run({ id: '1' })).resolves.toEqual({
      success: true,
      data: { id: '1' },
    });
  });

  it('strips deletedAt from objects, nested objects and arrays', async () => {
    const result = await run({
      id: '1',
      deletedAt: null,
      profile: { name: 'Ada', deletedAt: new Date() },
      items: [{ id: 'a', deletedAt: new Date() }],
    });

    expect(result).toEqual({
      success: true,
      data: {
        id: '1',
        profile: { name: 'Ada' },
        items: [{ id: 'a' }],
      },
    });
  });

  it('serializes Date instances to ISO strings while stripping around them', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const result = (await run({ createdAt, deletedAt: createdAt })) as {
      data: { createdAt: string };
    };

    expect(result.data).toEqual({ createdAt: createdAt.toISOString() });
  });

  it('leaves explicitly shaped success bodies untouched', async () => {
    const deletedAt = new Date();
    const body = { success: true, id: 'user-1', deletedAt };

    await expect(run(body)).resolves.toBe(body);
  });

  it('preserves data/meta pagination envelopes', async () => {
    const result = await run({
      data: [{ id: '1', deletedAt: new Date() }],
      meta: { page: 1 },
    });

    expect(result).toEqual({
      success: true,
      data: [{ id: '1' }],
      meta: { page: 1 },
    });
  });

  describe('trace context capture', () => {
    it('does nothing when the execution context has no HTTP switch (e.g. a bare stub)', async () => {
      await expect(run({ id: '1' })).resolves.toEqual({
        success: true,
        data: { id: '1' },
      });
    });

    it('fills in userId and entityId on the current tracing scope and mirrors them onto response headers', async () => {
      const { execContext, setHeader } = buildHttpContext({
        user: { id: 'user-42' },
        params: { claimId: 'claim-7' },
      });

      await runWithTracingContext({ correlationId: 'corr-9' }, async () => {
        await firstValueFrom(
          interceptor.intercept(execContext, {
            handle: () => of({ ok: true }),
          } as CallHandler),
        );

        expect(getTracingContext()).toMatchObject({
          correlationId: 'corr-9',
          userId: 'user-42',
          entityId: 'claim-7',
        });
      });

      expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'corr-9');
      expect(setHeader).toHaveBeenCalledWith('x-entity-id', 'claim-7');
    });

    it('leaves userId/entityId unset when the request is unauthenticated and has no id-like params', async () => {
      const { execContext, setHeader } = buildHttpContext({});

      await runWithTracingContext({ correlationId: 'corr-10' }, async () => {
        await firstValueFrom(
          interceptor.intercept(execContext, {
            handle: () => of({ ok: true }),
          } as CallHandler),
        );

        expect(getTracingContext()).toEqual({ correlationId: 'corr-10' });
      });

      expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'corr-10');
      expect(setHeader).not.toHaveBeenCalledWith(
        'x-entity-id',
        expect.anything(),
      );
    });

    it('is a no-op outside of a tracing scope', async () => {
      const { execContext } = buildHttpContext({ user: { id: 'user-1' } });

      await firstValueFrom(
        interceptor.intercept(execContext, {
          handle: () => of({ ok: true }),
        } as CallHandler),
      );

      expect(getTracingContext()).toBeUndefined();
    });
  });
});
