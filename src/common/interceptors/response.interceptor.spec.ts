import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseTransformInterceptor } from './response.interceptor';

describe('ResponseTransformInterceptor', () => {
  const interceptor = new ResponseTransformInterceptor();
  const context = {} as ExecutionContext;

  const run = (body: unknown) =>
    firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of(body),
      } as CallHandler),
    );

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
});
