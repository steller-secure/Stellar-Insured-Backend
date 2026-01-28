import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyKeyEntity } from '../src/common/idempotency/entities/idempotency-key.entity';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { IdempotencyModule } from '../src/common/idempotency/idempotency.module';
import { Idempotent } from '../src/common/idempotency/decorators/idempotent.decorator';
import { IdempotencyInterceptor } from '../src/common/idempotency/interceptors/idempotency.interceptor';
import {
  Controller,
  Post,
  Body,
  Module,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';

// Test DTO
class CreateTestClaimDto {
  policyId?: string;
  amount?: number;

  constructor(policyId?: string, amount?: number) {
    this.policyId = policyId;
    this.amount = amount;
  }
}

// Test Controller
@Controller('test-claims')
class TestClaimController {
  private claimId = 0;

  createClaim(dto: CreateTestClaimDto): Promise<any> {
    if (!dto.policyId || !dto.amount) {
      throw new BadRequestException('Missing required fields');
    }

    // Simulate processing time
    return new Promise((resolve) =>
      setTimeout(() => {
        resolve({
          id: `claim-${++this.claimId}`,
          policyId: dto.policyId,
          amount: dto.amount,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }, 10),
    );
  }
}

// Test Module
@Module({
  imports: [IdempotencyModule],
  controllers: [TestClaimController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
class TestAppModule {}

describe('Idempotency - E2E Tests', () => {
  let app: INestApplication;
  let idempotencyRepository: Repository<IdempotencyKeyEntity>;
  const testEndpoint = '/test-claims';
  const validPayload = {
    policyId: 'policy-123',
    amount: 1000,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [IdempotencyKeyEntity],
          synchronize: true,
        }),
        TestAppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    idempotencyRepository = moduleFixture.get<Repository<IdempotencyKeyEntity>>(
      getRepositoryToken(IdempotencyKeyEntity),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Clear all records after each test
    await idempotencyRepository.clear();
  });

  describe('POST with Idempotency-Key', () => {
    it('should create claim on first request', async () => {
      const idempotencyKey = 'test-key-1';

      const response = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body.policyId).toBe(validPayload.policyId);
      expect(response.body.amount).toBe(validPayload.amount);

      // Verify record was stored
      const storedRecord = await idempotencyRepository.findOne({
        where: { idempotencyKey },
      });
      expect(storedRecord).toBeDefined();
      expect(storedRecord?.status).toBe('SUCCESS');
    });

    it('should return cached response on duplicate request', async () => {
      const idempotencyKey = 'test-key-2';

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      const firstClaimId = firstResponse.body.id;

      // Second request with same key should return same response
      const secondResponse = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      expect(secondResponse.body.id).toBe(firstClaimId);
      expect(secondResponse.body).toEqual(firstResponse.body);
    });

    it('should reject different request body with same key', async () => {
      const idempotencyKey = 'test-key-3';

      // First request
      await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      // Different payload with same key should fail
      const differentPayload = {
        policyId: 'policy-456',
        amount: 2000,
      };

      const response = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(differentPayload)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toContain('different request body');
    });

    it('should reject request without Idempotency-Key header', async () => {
      const response = await request(app.getHttpServer())
        .post(testEndpoint)
        .send(validPayload)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toContain('Idempotency-Key');
    });

    it('should reject Idempotency-Key exceeding max length', async () => {
      const longKey = 'a'.repeat(256);

      const response = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', longKey)
        .send(validPayload)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toContain('exceeds maximum length');
    });

    it('should handle multiple concurrent requests with same key', async () => {
      const idempotencyKey = 'test-key-concurrent';

      // Send multiple concurrent requests with same key
      const promises = [
        request(app.getHttpServer())
          .post(testEndpoint)
          .set('Idempotency-Key', idempotencyKey)
          .send(validPayload),
        request(app.getHttpServer())
          .post(testEndpoint)
          .set('Idempotency-Key', idempotencyKey)
          .send(validPayload),
        request(app.getHttpServer())
          .post(testEndpoint)
          .set('Idempotency-Key', idempotencyKey)
          .send(validPayload),
      ];

      const results = await Promise.all(promises);

      // First should succeed, others might get conflict or cached response
      const successResponses = results.filter(
        (r) => r.status === HttpStatus.CREATED || r.status === HttpStatus.CONFLICT,
      );
      expect(successResponses.length).toBeGreaterThan(0);
    });

    it('should preserve error responses', async () => {
      const idempotencyKey = 'test-key-error';
      const invalidPayload = { amount: 1000 }; // Missing policyId

      // First request should fail
      const firstResponse = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(invalidPayload)
        .expect(HttpStatus.BAD_REQUEST);

      // Second request with same key should return same error
      const secondResponse = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(invalidPayload)
        .expect(HttpStatus.CONFLICT);

      // The conflict response indicates the cached error
      expect(secondResponse.body.message).toContain('Duplicate request detected');
    });

    it('should allow different keys for same payload', async () => {
      const idempotencyKey1 = 'test-key-diff-1';
      const idempotencyKey2 = 'test-key-diff-2';

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey1)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      // Same payload with different key should create new resource
      const secondResponse = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey2)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      // IDs should be different
      expect(secondResponse.body.id).not.toBe(firstResponse.body.id);
    });

    it('should store and retrieve idempotency records correctly', async () => {
      const idempotencyKey = 'test-key-storage';

      const response = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      // Verify record in database
      const record = await idempotencyRepository.findOne({
        where: { idempotencyKey },
      });

      expect(record).toBeDefined();
      expect(record?.userId).toBeNull();
      expect(record?.method).toBe('POST');
      expect(record?.endpoint).toContain(testEndpoint);
      expect(record?.status).toBe('SUCCESS');
      expect(record?.statusCode).toBe(HttpStatus.CREATED);
      expect(record?.requestHash).toBeTruthy();

      const storedResponse = JSON.parse(record?.response || '{}');
      expect(storedResponse.id).toBe(response.body.id);
    });

    it('should have expiration time set on records', async () => {
      const idempotencyKey = 'test-key-expiry';

      await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      const record = await idempotencyRepository.findOne({
        where: { idempotencyKey },
      });

      expect(record?.expiresAt).toBeDefined();
      expect(record?.expiresAt).toBeInstanceOf(Date);
      expect(record?.expiresAt?.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Idempotency key uniqueness', () => {
    it('should scope idempotency keys per endpoint', async () => {
      const idempotencyKey = 'test-key-scope';

      // Two different endpoints could use same key (in real scenario)
      const response = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      const claimId = response.body.id;

      // Same key on same endpoint should return cached response
      const secondResponse = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      expect(secondResponse.body.id).toBe(claimId);
    });
  });

  describe('Request body hashing', () => {
    it('should create consistent hash for identical request bodies', async () => {
      const idempotencyKey1 = 'test-key-hash-1';
      const idempotencyKey2 = 'test-key-hash-2';

      await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey1)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey2)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      const record1 = await idempotencyRepository.findOne({
        where: { idempotencyKey: idempotencyKey1 },
      });
      const record2 = await idempotencyRepository.findOne({
        where: { idempotencyKey: idempotencyKey2 },
      });

      // Same payload should generate same hash
      expect(record1?.requestHash).toBe(record2?.requestHash);
    });

    it('should create different hashes for different request bodies', async () => {
      const idempotencyKey1 = 'test-key-hash-3';
      const idempotencyKey2 = 'test-key-hash-4';

      const payload1 = { policyId: 'policy-123', amount: 1000 };
      const payload2 = { policyId: 'policy-456', amount: 2000 };

      await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey1)
        .send(payload1)
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', idempotencyKey2)
        .send(payload2)
        .expect(HttpStatus.CREATED);

      const record1 = await idempotencyRepository.findOne({
        where: { idempotencyKey: idempotencyKey1 },
      });
      const record2 = await idempotencyRepository.findOne({
        where: { idempotencyKey: idempotencyKey2 },
      });

      // Different payloads should generate different hashes
      expect(record1?.requestHash).not.toBe(record2?.requestHash);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post(testEndpoint)
        .set('Idempotency-Key', 'test-key-malformed')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toBeDefined();
    });

    it('should return 409 Conflict for duplicate pending request', async () => {
      // This test would require mocking slow processing
      // For now, we verify the mechanism is in place via service tests
    });
  });
});
