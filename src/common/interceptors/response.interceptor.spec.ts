import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
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

  it('converts Date class instances to ISO strings while stripping around them', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const result = (await run({ createdAt, deletedAt: createdAt })) as {
      data: { createdAt: string };
    };

    // `createdAt` is legitimately serialized to an ISO string; the
    // soft-delete marker is dropped.
    expect(result.data).toEqual({ createdAt: '2026-01-01T00:00:00.000Z' });
    expect(result.data.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect((result.data as any).deletedAt).toBeUndefined();
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

  it('strips internal-only fields from the meta envelope too', async () => {
    const result = await run({
      data: [{ id: '1' }],
      meta: { page: 1, total: 2, deletedAt: new Date() },
    });

    expect(result).toEqual({
      success: true,
      data: [{ id: '1' }],
      meta: { page: 1, total: 2 },
    });
  });

  it('does not leak internal-only fields through deeply nested payloads', async () => {
    let data: Record<string, unknown> = { deletedAt: new Date() };
    for (let i = 0; i < 25; i++) {
      data = { level: data };
    }

    const result = (await run(data)) as { data: { level: unknown } };
    let node: unknown = result.data;
    for (let i = 0; i < 25; i++) {
      node = (node as { level: unknown }).level;
    }
    expect(node).toEqual({});
  });

  it('terminates on circular payloads instead of hanging or crashing', async () => {
    const circular: Record<string, unknown> = {
      deletedAt: new Date(),
      label: 'loop',
    };
    circular.self = circular;

    const result = (await run(circular)) as {
      success: boolean;
      data: Record<string, unknown>;
    };
    expect(result.success).toBe(true);
    expect(result.data.label).toBe('loop');
    expect(result.data.deletedAt).toBeUndefined();
  });

  it('strips internal-only fields even when primary serialization falls back to safeSerialize', async () => {
    // A property getter that throws forces SerializationTransformer.transform
    // to fail, exercising the safeSerialize fallback path.
    const boom = {
      get value(): string {
        throw new Error('boom');
      },
    };

    const result = (await run({
      id: '1',
      deletedAt: new Date(),
      boom,
    })) as { success: boolean; data: Record<string, unknown> };

    expect(result.success).toBe(true);
    expect(result.data.id).toBe('1');
    expect(result.data.deletedAt).toBeUndefined();
    expect(result.data.boom).toBe('[object Object]');
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

    it('mirrors trace headers onto the response before the handler runs, so they survive error responses', async () => {
      const { execContext, setHeader } = buildHttpContext({
        user: { id: 'user-99' },
        params: { policyId: 'policy-3' },
      });

      await runWithTracingContext({ correlationId: 'corr-err' }, async () => {
        await expect(
          firstValueFrom(
            interceptor.intercept(execContext, {
              handle: () => throwError(() => new Error('handler boom')),
            } as CallHandler),
          ),
        ).rejects.toThrow('handler boom');
      });

      expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'corr-err');
      expect(setHeader).toHaveBeenCalledWith('x-entity-id', 'policy-3');
    });

    it('tolerates missing correlation metadata (no tracing scope) without throwing', async () => {
      const { execContext } = buildHttpContext({});

      await expect(
        firstValueFrom(
          interceptor.intercept(execContext, {
            handle: () => of({ ok: true }),
          } as CallHandler),
        ),
      ).resolves.toEqual({ success: true, data: { ok: true } });
    });
  });
});
