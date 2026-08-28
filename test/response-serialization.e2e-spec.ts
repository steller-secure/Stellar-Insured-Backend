import {
  Controller,
  Get,
  INestApplication,
  Module,
  Param,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { correlationIdHandler } from '../src/middleware/correlation-id.middleware';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response.interceptor';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('serialization-probe')
class SerializationProbeController {
  @Get('record/:id')
  record(@Param('id') id: string) {
    return {
      id,
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-02-02T00:00:00.000Z'),
      holder: {
        name: 'Ada',
        deletedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      items: [
        { sku: 'a', deletedAt: new Date() },
        [{ sku: 'b', deletedAt: new Date() }],
      ],
    };
  }

  @Get('envelope')
  envelope() {
    return {
      data: [{ id: 'p1', deletedAt: new Date('2026-01-01T00:00:00.000Z') }],
      meta: { page: 1, limit: 20, total: 1, deletedAt: new Date() },
    };
  }

  @Get('deep')
  deep() {
    let payload: Record<string, unknown> = { deletedAt: new Date() };
    for (let i = 0; i < 25; i++) {
      payload = { level: payload };
    }
    return payload;
  }

  @Get(':id/boom')
  boom(): never {
    throw new Error('internal detail that must never reach the client');
  }
}

@Module({
  controllers: [SerializationProbeController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
class SerializationProbeModule {}

/**
 * End-to-end coverage for issue #487: response serialization hardening.
 * Verifies the public response envelope, stripping of internal-only fields
 * (soft-delete `deletedAt`) at any nesting depth, and that correlation /
 * trace headers survive both successful and error responses without leaking
 * sensitive internals.
 */
describe('Response serialization end-to-end (issue #487)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SerializationProbeModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    // Mirrors main.ts: correlation middleware must be registered first so
    // every request runs inside the tracing scope.
    app.use(correlationIdHandler);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps payloads in the success envelope and strips deletedAt at every nesting level', async () => {
    const response = await request(app.getHttpServer())
      .get('/serialization-probe/record/policy-1')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        id: 'policy-1',
        createdAt: '2026-02-02T00:00:00.000Z',
        holder: { name: 'Ada' },
        items: [{ sku: 'a' }, [{ sku: 'b' }]],
      },
    });
    // No soft-delete marker anywhere in the serialized body.
    expect(JSON.stringify(response.body)).not.toContain('deletedAt');
  });

  it('strips internal-only fields from both data and meta in pagination envelopes', async () => {
    const response = await request(app.getHttpServer())
      .get('/serialization-probe/envelope')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: [{ id: 'p1' }],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });

  it('strips deletedAt from payloads nested far deeper than any fixed depth cap', async () => {
    const response = await request(app.getHttpServer())
      .get('/serialization-probe/deep')
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain('deletedAt');
  });

  it('returns x-correlation-id and x-entity-id headers on successful responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/serialization-probe/record/policy-7')
      .expect(200);

    expect(response.headers['x-correlation-id']).toBeTruthy();
    expect(response.headers['x-entity-id']).toBe('policy-7');
  });

  it('echoes a valid inbound correlation id back on the response', async () => {
    const correlationId = '9f8e7d6c-5b4a-3210-9876-543210fedcba';
    const response = await request(app.getHttpServer())
      .get('/serialization-probe/record/policy-1')
      .set('x-correlation-id', correlationId)
      .expect(200);

    expect(response.headers['x-correlation-id']).toBe(correlationId);
  });

  it('assigns a valid correlation id when none is supplied', async () => {
    const response = await request(app.getHttpServer())
      .get('/serialization-probe/record/policy-1')
      .expect(200);

    expect(response.headers['x-correlation-id']).toMatch(UUID_RE);
  });

  it('replaces an invalid correlation id with a valid one instead of trusting it', async () => {
    const response = await request(app.getHttpServer())
      .get('/serialization-probe/record/policy-1')
      .set('x-correlation-id', 'not-a-uuid')
      .expect(200);

    expect(response.headers['x-correlation-id']).toMatch(UUID_RE);
    expect(response.headers['x-correlation-id']).not.toBe('not-a-uuid');
  });

  it('keeps trace headers on error responses and quotes the correlation id in the error body', async () => {
    const response = await request(app.getHttpServer())
      .get('/serialization-probe/claim-500/boom')
      .expect(500);

    const correlationId = response.headers['x-correlation-id'];
    expect(correlationId).toBeTruthy();
    expect(response.headers['x-entity-id']).toBe('claim-500');

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(response.body.error.requestId).toBe(correlationId);
  });

  it('does not leak internal exception details or stack traces in error responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/serialization-probe/claim-500/boom')
      .expect(500);

    const bodyText = JSON.stringify(response.body);
    expect(bodyText).not.toContain('internal detail that must never reach');
    expect(bodyText).not.toContain('at ');
    expect(response.body.error.stack).toBeUndefined();
    expect(response.body.error.details).toBeNull();
  });
});
