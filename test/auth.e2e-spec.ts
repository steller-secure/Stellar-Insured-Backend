import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { UserService } from '../src/user/user.service';
import { NonceService } from '../src/nonce/nonce.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let userService: UserService;
  let nonceService: NonceService;
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
    nonceService = app.get<NonceService>(NonceService);

    // Create a test user
    const user = await userService.create('auth-test@example.com');
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  describe('/auth/login (POST)', () => {
    it('should return a JWT token for a valid user and nonce', async () => {
      const nonce = await nonceService.createNonce(userId);
      const loginDto = {
        userId,
        nonce,
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
    });

    it('should reject a login attempt with an invalid nonce', async () => {
      const loginDto = {
        userId,
        nonce: 'invalid-nonce',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });

    it('should reject a login attempt with a used nonce', async () => {
      const nonce = await nonceService.createNonce(userId);
      const loginDto = {
        userId,
        nonce,
      };

      // First login attempt should succeed
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(201);

      // Second login attempt with the same nonce should fail
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });
  });
});
