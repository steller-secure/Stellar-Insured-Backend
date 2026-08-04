import { Request, Response } from 'express';
import {
  CorrelationIdMiddleware,
  correlationIdHandler,
} from './correlation-id.middleware';
import { getCorrelationId, getTracingContext } from '../common/tracing/tracing-context';

function createMockReqRes(headers: Record<string, string> = {}) {
  const req = {
    headers: { ...headers },
    method: 'GET',
    url: '/probe',
    ip: '127.0.0.1',
    get: () => 'jest-agent',
  } as unknown as Request;

  const res = {
    setHeader: jest.fn(),
  } as unknown as Response;

  return { req, res };
}

describe('correlationIdHandler', () => {
  it('generates a correlation ID and opens a tracing scope around next()', () => {
    const { req, res } = createMockReqRes();
    let observedInsideNext: string | undefined;

    correlationIdHandler(req, res, () => {
      observedInsideNext = getCorrelationId();
    });

    expect(observedInsideNext).toBeDefined();
    expect(req.headers['x-correlation-id']).toBe(observedInsideNext);
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      observedInsideNext,
    );
    // Scope is closed once correlationIdHandler returns.
    expect(getCorrelationId()).toBeUndefined();
  });

  it('reuses an inbound x-correlation-id header when it is a valid UUID', () => {
    const inboundId = '11111111-2222-4333-8444-555555555555';
    const { req, res } = createMockReqRes({ 'x-correlation-id': inboundId });
    let observed: string | undefined;

    correlationIdHandler(req, res, () => {
      observed = getCorrelationId();
    });

    expect(observed).toBe(inboundId);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', inboundId);
  });

  it('mints a fresh correlation ID when the inbound header is not a valid UUID', () => {
    const { req, res } = createMockReqRes({
      'x-correlation-id': 'not-a-uuid',
    });
    let observed: string | undefined;

    correlationIdHandler(req, res, () => {
      observed = getCorrelationId();
    });

    expect(observed).toBeDefined();
    expect(observed).not.toBe('not-a-uuid');
  });

  it('keeps the scope open across an async continuation started inside next()', async () => {
    const { req, res } = createMockReqRes();
    let afterAwait: string | undefined;

    await new Promise<void>((resolve) => {
      correlationIdHandler(req, res, () => {
        setImmediate(() => {
          afterAwait = getCorrelationId();
          resolve();
        });
      });
    });

    expect(afterAwait).toBeDefined();
    expect(afterAwait).toBe(req.headers['x-correlation-id']);
  });

  it('redacts the request metadata it stashes on the request', () => {
    const { req, res } = createMockReqRes();
    correlationIdHandler(req, res, () => undefined);

    expect(req.redactedMeta).toMatchObject({
      correlationId: req.headers['x-correlation-id'],
      method: 'GET',
      url: '/probe',
    });
  });
});

describe('CorrelationIdMiddleware', () => {
  it('delegates to correlationIdHandler', () => {
    const middleware = new CorrelationIdMiddleware();
    const { req, res } = createMockReqRes();
    let ctx: ReturnType<typeof getTracingContext>;

    middleware.use(req, res, () => {
      ctx = getTracingContext();
    });

    expect(ctx!).toBeDefined();
    expect(ctx!.correlationId).toBe(req.headers['x-correlation-id']);
  });
});
