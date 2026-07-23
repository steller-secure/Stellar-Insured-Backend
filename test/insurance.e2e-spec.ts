import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { UserService } from '../src/user/user.service';
import { InsuranceService } from '../src/insurance/insurance.service';
import { RiskType } from '../src/insurance/enums/risk-type.enum';

describe('InsuranceController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let userService: UserService;
  let insuranceService: InsuranceService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    authService = app.get<AuthService>(AuthService);
    userService = app.get<UserService>(UserService);
    insuranceService = app.get<InsuranceService>(InsuranceService);

    // Create a test user
    const user = await userService.create('test@example.com');
    userId = user.id;

    // Generate a JWT token for the test user
    authToken = (await authService.login(user)).access_token;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  describe('/insurance/purchase (POST)', () => {
    it('should purchase an insurance policy for an authenticated user', async () => {
      // Create a test pool
      const pool = await prisma.insurancePool.create({
        data: {
          name: 'Test Pool',
          capital: 100000,
        },
      });

      const purchaseDto = {
        poolId: pool.id,
        riskType: RiskType.PROJECT_FAILURE,
        coverageAmount: 1000,
      };

      const response = await request(app.getHttpServer())
        .post('/insurance/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send(purchaseDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.userId).toBe(userId);
      expect(response.body.poolId).toBe(pool.id);

      // Clean up the created policy and pool
      await prisma.insurancePolicy.delete({ where: { id: response.body.id } });
      await prisma.insurancePool.delete({ where: { id: pool.id } });
    });
  });
});
