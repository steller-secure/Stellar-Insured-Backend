import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { UsersService } from './../src/modules/users/users.service';
import { Keypair } from 'stellar-sdk';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    usersService = app.get<UsersService>(UsersService);
  });

  afterEach(async () => {
    await app.close();
  });

  const validWallet = Keypair.random();
  const validWalletAddress = validWallet.publicKey();

  describe('/api/v1/auth/login/challenge (POST)', () => {
    it('should return 400 for invalid wallet address', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login/challenge')
        .send({ walletAddress: 'INVALID' })
        .expect(400);
    });

    it('should return challenge for valid wallet address', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login/challenge')
        .send({ walletAddress: validWalletAddress })
        .expect(200);

      expect(response.body).toHaveProperty('challenge');
      expect(response.body).toHaveProperty('expiresAt');
      // expect(response.body.challenge).toContain(validWalletAddress); // Not required by prompt response format
    });
  });

  describe('/api/v1/auth/login (POST)', () => {
    it('should return 404 if user is not registered', async () => {
      // 1. Get Challenge
      const challengeRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login/challenge')
        .send({ walletAddress: validWalletAddress })
        .expect(200);

      const message = challengeRes.body.challenge;
      const signature = validWallet
        .sign(Buffer.from(message))
        .toString('base64');

      // 2. Try Login (User not seeded)
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          walletAddress: validWalletAddress,
          signature: signature,
        })
        .expect(404); // UserNotFoundException or NotFoundException
    });

    it('should return JWT token for registered user with valid signature', async () => {
      // 0. Seed User
      await usersService.create(validWalletAddress);

      // 1. Get Challenge
      const challengeRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login/challenge')
        .send({ walletAddress: validWalletAddress })
        .expect(200);

      const message = challengeRes.body.challenge;
      const signature = validWallet
        .sign(Buffer.from(message))
        .toString('base64');

      // 2. Login
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          walletAddress: validWalletAddress,
          signature: signature,
        })
        .expect(200);

      expect(loginRes.body).toHaveProperty('accessToken');
      expect(loginRes.body).toHaveProperty('user');
      expect(loginRes.body.user.walletAddress).toBe(validWalletAddress);
    });

    it('should fail with invalid signature', async () => {
      // 0. Seed User
      await usersService.create(validWalletAddress);

      // 1. Get Challenge
      const challengeRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login/challenge')
        .send({ walletAddress: validWalletAddress })
        .expect(200);

      const message = challengeRes.body.challenge;

      // Sign logic with WRONG KEY
      const wrongKey = Keypair.random();
      const signature = wrongKey.sign(Buffer.from(message)).toString('base64');

      // 2. Login
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          walletAddress: validWalletAddress,
          signature: signature,
        })
        .expect(401);
    });

    it('should prevent replay attacks (nonce reuse)', async () => {
      // 0. Seed User
      await usersService.create(validWalletAddress);

      // 1. Get Challenge
      const challengeRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login/challenge')
        .send({ walletAddress: validWalletAddress })
        .expect(200);

      const message = challengeRes.body.challenge;
      const signature = validWallet
        .sign(Buffer.from(message))
        .toString('base64');

      // 2. Login First Time (Success)
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          walletAddress: validWalletAddress,
          signature: signature,
        })
        .expect(200);

      // 3. Login Second Time (Fail - Challenge consumed)
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          walletAddress: validWalletAddress,
          signature: signature,
        })
        .expect(404); // Challenge not found
    });
  });
});
