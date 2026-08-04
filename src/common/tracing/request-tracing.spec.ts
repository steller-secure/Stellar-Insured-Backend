import {
  Controller,
  Get,
  INestApplication,
  Injectable,
  Logger,
  Module,
  Param,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as winston from 'winston';
import Transport from 'winston-transport';
import { correlationIdHandler } from '../../middleware/correlation-id.middleware';
import { AllExceptionsFilter } from '../filters/http-exception.filter';
import { ResponseTransformInterceptor } from '../interceptors/response.interceptor';
import { tracingFormat, NestWinstonLogger } from '../../config/winston.config';
import { redactFormat } from '../utils/log-redaction.util';

/** In-memory winston transport so the test can inspect every emitted log entry. */
class MemoryTransport extends Transport {
  entries: winston.Logform.TransformableInfo[] = [];

  log(info: winston.Logform.TransformableInfo, callback: () => void): void {
    this.entries.push(info);
    callback();
  }
}

@Injectable()
class ProbeService {
  private readonly logger = new Logger(ProbeService.name);

  async doWork(claimId: string): Promise<void> {
    this.logger.log(`starting work for claim ${claimId}`);
    // Cross a real async boundary so this proves AsyncLocalStorage
    // propagation, not just a same-tick coincidence.
    await new Promise((resolve) => setImmediate(resolve));
    this.logger.log('finished work');
  }
}

@Controller('trace-probe')
class ProbeController {
  constructor(private readonly probe: ProbeService) {}

  @Get(':claimId')
  async get(@Param('claimId') claimId: string): Promise<{ claimId: string }> {
    await this.probe.doWork(claimId);
    return { claimId };
  }

  @Get(':claimId/boom')
  async boom(@Param('claimId') claimId: string): Promise<never> {
    await this.probe.doWork(claimId);
    throw new Error('boom');
  }
}

@Module({
  controllers: [ProbeController],
  providers: [
    ProbeService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
class TracingProbeModule {}

/**
 * End-to-end coverage for issue #455 (structured request tracing). Before
 * this feature, correlation-id.middleware.ts set a header but nothing wired
 * it into the AsyncLocalStorage-free Nest Logger, so an arbitrary
 * `new Logger().log(...)` call anywhere in the request had no way to know
 * the correlation ID — this test would have failed against the old code.
 */
describe('Request tracing end-to-end (issue #455)', () => {
  let app: INestApplication;
  let memoryTransport: MemoryTransport;

  beforeAll(async () => {
    memoryTransport = new MemoryTransport();
    const testLogger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        tracingFormat(),
        redactFormat(),
        winston.format.json(),
      ),
      transports: [memoryTransport],
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TracingProbeModule],
    }).compile();

    // Mirrors main.ts: NestWinstonLogger adapts Nest's (message, context)
    // calling convention onto winston's shortcut methods. Passing a raw
    // winston.Logger here would silently drop every entry (winston's own
    // .log(level, msg) reads the message text as an invalid level).
    app = moduleFixture.createNestApplication({
      logger: new NestWinstonLogger(testLogger),
    });
    // Registered first, exactly like main.ts, so every log emitted while
    // handling the request (including from services several calls deep) is
    // inside the tracing scope.
    app.use(correlationIdHandler);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    memoryTransport.entries = [];
  });

  it('stamps the same correlation ID onto every log line emitted while handling a request', async () => {
    const response = await request(app.getHttpServer())
      .get('/trace-probe/claim-123')
      .expect(200);

    const correlationId = response.headers['x-correlation-id'];
    expect(correlationId).toBeTruthy();
    expect(response.headers['x-entity-id']).toBe('claim-123');

    // Sanity check: multiple log lines were actually emitted across an
    // async boundary, so the assertion below isn't vacuously true.
    expect(memoryTransport.entries.length).toBeGreaterThanOrEqual(2);

    for (const entry of memoryTransport.entries) {
      expect(entry.correlationId).toBe(correlationId);
    }
  });

  it('keeps the correlation ID on error logs and echoes it in the error response body', async () => {
    const response = await request(app.getHttpServer())
      .get('/trace-probe/claim-500/boom')
      .expect(500);

    const correlationId = response.headers['x-correlation-id'];
    expect(correlationId).toBeTruthy();
    expect(response.body.error.requestId).toBe(correlationId);

    expect(memoryTransport.entries.length).toBeGreaterThan(0);
    for (const entry of memoryTransport.entries) {
      expect(entry.correlationId).toBe(correlationId);
    }
  });

  it('uses a distinct correlation ID per request', async () => {
    const first = await request(app.getHttpServer())
      .get('/trace-probe/claim-a')
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/trace-probe/claim-b')
      .expect(200);

    expect(first.headers['x-correlation-id']).not.toBe(
      second.headers['x-correlation-id'],
    );
  });
});
