import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LogSanitizerMiddleware } from './log-sanitizer.middleware';
import { REDACTED, REDACTED_EMAIL } from '../utils/log-redaction.util';

describe('LogSanitizerMiddleware', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(app.getHttpAdapter().getInstance());
    app.use(new LogSanitizerMiddleware().use.bind(new LogSanitizerMiddleware()));
  });

  afterEach(async () => {
    await app.close();
  });

  it('should redact sensitive headers', async () => {
    let capturedHeaders: Record<string, unknown> = {};
    const originalJson = app.getHttpAdapter().getInstance().res.json.bind(app.getHttpAdapter().getInstance().res);
    
    app.getHttpAdapter().getInstance().use((req: any, res: any, next: any) => {
      capturedHeaders = { ...req.headers };
      res.status(404).send('Not Found');
    });

    await request(app.getHttpServer())
      .get('/test')
      .set('Authorization', 'Bearer secret-token')
      .set('X-API-Key', 'api-key-123')
      .expect(404);

    expect(capturedHeaders['authorization']).toBe(REDACTED);
    expect(capturedHeaders['x-api-key']).toBe(REDACTED);
    expect(capturedHeaders['host']).toBeDefined();
  });

  it('should redact sensitive body fields', async () => {
    let capturedBody: any;
    
    app.getHttpAdapter().getInstance().use((req: any, res: any, next: any) => {
      capturedBody = req.body;
      res.status(404).send('Not Found');
    });

    await request(app.getHttpServer())
      .post('/test')
      .send({
        email: 'test@example.com',
        password: 'secret123',
        name: 'John Doe',
      })
      .expect(404);

    expect(capturedBody.email).toBe(REDACTED);
    expect(capturedBody.password).toBe(REDACTED);
    expect(capturedBody.name).toBe('John Doe');
  });
});
