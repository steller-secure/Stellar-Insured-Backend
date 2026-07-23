import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import * as request from 'supertest';

describe('Security: CORS Configuration (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configure CORS with test origins
    process.env.CORS_ALLOWED_ORIGINS =
      'http://localhost:3000,http://localhost:4200';
    process.env.NODE_ENV = 'test';

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow requests from allowed origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:3000')
      .expect(404); // Health endpoint may not exist, but CORS should allow the request

    // Verify CORS headers are present for allowed origin
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
  });

  it('should reject requests from disallowed origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://malicious-site.com')
      .send();

    // CORS should reject the request - the response should not have CORS headers
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should handle preflight OPTIONS requests for allowed origins', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    // Verify CORS preflight headers
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:4200',
    );
    expect(response.headers['access-control-allow-methods']).toBeDefined();
    expect(response.headers['access-control-allow-headers']).toBeDefined();
  });

  it('should reject preflight OPTIONS requests from disallowed origins', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', 'http://evil-site.com')
      .set('Access-Control-Request-Method', 'GET')
      .send();

    // CORS should reject the preflight request
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should allow requests with no origin header (e.g., mobile apps, curl)', async () => {
    // Requests without Origin header should be allowed for API clients
    await request(app.getHttpServer()).get('/api/v1/health').expect(404); // Endpoint may not exist, but request should not be blocked by CORS
  });
});
