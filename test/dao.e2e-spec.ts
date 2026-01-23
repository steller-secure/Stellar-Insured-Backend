import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../src/modules/users/entities/user.entity';
import { Proposal } from '../src/modules/dao/entities/proposal.entity';
import { Vote } from '../src/modules/dao/entities/vote.entity';
import { ProposalStatus } from '../src/modules/dao/enums/proposal-status.enum';
import { VoteType } from '../src/modules/dao/enums/vote-type.enum';
import { UsersModule } from '../src/modules/users/users.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { DaoModule } from '../src/modules/dao/dao.module';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';

describe('DAO Module (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let proposalRepository: Repository<Proposal>;
  let voteRepository: Repository<Vote>;
  let jwtService: JwtService;

  let testUser: User;
  let testUserWithoutWallet: User;
  let testProposal: Proposal;
  let authToken: string;
  let authTokenWithoutWallet: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get<string>('DATABASE_HOST', 'localhost'),
            port: configService.get<number>('DATABASE_PORT', 5432),
            username: configService.get<string>('DATABASE_USERNAME', 'test'),
            password: configService.get<string>('DATABASE_PASSWORD', 'test'),
            database: configService.get<string>(
              'DATABASE_NAME',
              'stellar_insured_test',
            ),
            entities: [User, Proposal, Vote],
            synchronize: true,
            dropSchema: true, // Clean database for each test run
          }),
        }),
        UsersModule,
        AuthModule,
        DaoModule,
      ],
      providers: [
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    proposalRepository = moduleFixture.get<Repository<Proposal>>(
      getRepositoryToken(Proposal),
    );
    voteRepository = moduleFixture.get<Repository<Vote>>(
      getRepositoryToken(Vote),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  beforeEach(async () => {
    // Clean up tables
    await voteRepository.delete({});
    await proposalRepository.delete({});
    await userRepository.delete({});

    // Create test users
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);

    testUser = await userRepository.save({
      email: 'testuser@example.com',
      passwordHash,
      stellarAddress:
        'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      isActive: true,
    });

    testUserWithoutWallet = await userRepository.save({
      email: 'nowallet@example.com',
      passwordHash,
      isActive: true,
    });

    // Generate JWT tokens
    authToken = jwtService.sign({ sub: testUser.id, email: testUser.email });
    authTokenWithoutWallet = jwtService.sign({
      sub: testUserWithoutWallet.id,
      email: testUserWithoutWallet.email,
    });

    // Create test proposal
    testProposal = await proposalRepository.save({
      title: 'Test Proposal',
      description: 'A test proposal for E2E testing',
      status: ProposalStatus.ACTIVE,
      startDate: new Date(Date.now() - 86400000), // Yesterday
      endDate: new Date(Date.now() + 86400000 * 7), // 1 week from now
      createdById: testUser.id,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /dao/proposals/:id/vote', () => {
    it('should cast a vote successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/dao/proposals/${testProposal.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ voteType: VoteType.FOR })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.voteType).toBe(VoteType.FOR);
      expect(response.body.walletAddress).toBe(testUser.stellarAddress);
      expect(response.body.proposalId).toBe(testProposal.id);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/dao/proposals/${testProposal.id}/vote`)
        .send({ voteType: VoteType.FOR })
        .expect(401);
    });

    it('should return 403 without Stellar wallet', async () => {
      await request(app.getHttpServer())
        .post(`/dao/proposals/${testProposal.id}/vote`)
        .set('Authorization', `Bearer ${authTokenWithoutWallet}`)
        .send({ voteType: VoteType.FOR })
        .expect(403);
    });

    it('should return 404 for non-existent proposal', async () => {
      await request(app.getHttpServer())
        .post('/dao/proposals/00000000-0000-0000-0000-000000000000/vote')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ voteType: VoteType.FOR })
        .expect(404);
    });

    it('should return 409 for duplicate vote', async () => {
      // First vote
      await request(app.getHttpServer())
        .post(`/dao/proposals/${testProposal.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ voteType: VoteType.FOR })
        .expect(201);

      // Duplicate vote attempt
      await request(app.getHttpServer())
        .post(`/dao/proposals/${testProposal.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ voteType: VoteType.AGAINST })
        .expect(409);
    });

    it('should return 400 for expired proposal', async () => {
      // Create expired proposal
      const expiredProposal = await proposalRepository.save({
        title: 'Expired Proposal',
        description: 'An expired proposal',
        status: ProposalStatus.ACTIVE,
        startDate: new Date(Date.now() - 86400000 * 14), // 2 weeks ago
        endDate: new Date(Date.now() - 86400000), // Yesterday
        createdById: testUser.id,
      });

      await request(app.getHttpServer())
        .post(`/dao/proposals/${expiredProposal.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ voteType: VoteType.FOR })
        .expect(400);
    });

    it('should return 400 for proposal not yet started', async () => {
      // Create future proposal
      const futureProposal = await proposalRepository.save({
        title: 'Future Proposal',
        description: 'A future proposal',
        status: ProposalStatus.ACTIVE,
        startDate: new Date(Date.now() + 86400000), // Tomorrow
        endDate: new Date(Date.now() + 86400000 * 7), // 1 week from now
        createdById: testUser.id,
      });

      await request(app.getHttpServer())
        .post(`/dao/proposals/${futureProposal.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ voteType: VoteType.FOR })
        .expect(400);
    });

    it('should return 400 for draft proposal', async () => {
      // Create draft proposal
      const draftProposal = await proposalRepository.save({
        title: 'Draft Proposal',
        description: 'A draft proposal',
        status: ProposalStatus.DRAFT,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000 * 7),
        createdById: testUser.id,
      });

      await request(app.getHttpServer())
        .post(`/dao/proposals/${draftProposal.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ voteType: VoteType.FOR })
        .expect(400);
    });

    it('should validate voteType enum', async () => {
      await request(app.getHttpServer())
        .post(`/dao/proposals/${testProposal.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ voteType: 'INVALID' })
        .expect(400);
    });
  });

  describe('GET /dao/proposals/:id/results', () => {
    it('should return empty results for proposal with no votes', async () => {
      const response = await request(app.getHttpServer())
        .get(`/dao/proposals/${testProposal.id}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.proposalId).toBe(testProposal.id);
      expect(response.body.totalVotes).toBe(0);
      expect(response.body.forVotes).toBe(0);
      expect(response.body.againstVotes).toBe(0);
      expect(response.body.abstainVotes).toBe(0);
      expect(response.body.hasQuorum).toBe(false);
      expect(response.body.percentages).toEqual({
        for: 0,
        against: 0,
        abstain: 0,
      });
    });

    it('should return aggregated results with votes', async () => {
      // Create multiple users with wallets and cast votes
      const users = [];
      for (let i = 0; i < 12; i++) {
        const user = await userRepository.save({
          email: `voter${i}@example.com`,
          passwordHash: await bcrypt.hash('TestPassword123!', 10),
          stellarAddress:
            `GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX${i.toString().padStart(2, '0')}`.slice(
              0,
              56,
            ),
          isActive: true,
        });
        users.push(user);
      }

      // Cast votes: 7 FOR, 3 AGAINST, 2 ABSTAIN
      const voteTypes = [
        ...Array(7).fill(VoteType.FOR),
        ...Array(3).fill(VoteType.AGAINST),
        ...Array(2).fill(VoteType.ABSTAIN),
      ];

      for (let i = 0; i < users.length; i++) {
        await voteRepository.save({
          proposalId: testProposal.id,
          userId: users[i].id,
          walletAddress: users[i].stellarAddress!,
          voteType: voteTypes[i],
        });
      }

      const response = await request(app.getHttpServer())
        .get(`/dao/proposals/${testProposal.id}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.proposalId).toBe(testProposal.id);
      expect(response.body.totalVotes).toBe(12);
      expect(response.body.forVotes).toBe(7);
      expect(response.body.againstVotes).toBe(3);
      expect(response.body.abstainVotes).toBe(2);
      expect(response.body.hasQuorum).toBe(true);
      expect(response.body.percentages.for).toBeCloseTo(58.33, 1);
      expect(response.body.percentages.against).toBeCloseTo(25, 1);
      expect(response.body.percentages.abstain).toBeCloseTo(16.67, 1);
    });

    it('should return 404 for non-existent proposal', async () => {
      await request(app.getHttpServer())
        .get('/dao/proposals/00000000-0000-0000-0000-000000000000/results')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/dao/proposals/${testProposal.id}/results`)
        .expect(401);
    });
  });

  describe('GET /dao/proposals', () => {
    it('should return paginated list of proposals', async () => {
      const response = await request(app.getHttpServer())
        .get('/dao/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('proposals');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.proposals)).toBe(true);
    });

    it('should filter by status', async () => {
      // Create proposals with different statuses
      await proposalRepository.save({
        title: 'Draft Proposal',
        description: 'A draft proposal',
        status: ProposalStatus.DRAFT,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000 * 7),
        createdById: testUser.id,
      });

      const response = await request(app.getHttpServer())
        .get('/dao/proposals')
        .query({ status: ProposalStatus.ACTIVE })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(
        response.body.proposals.every(
          (p: any) => p.status === ProposalStatus.ACTIVE,
        ),
      ).toBe(true);
    });
  });

  describe('GET /dao/proposals/:id', () => {
    it('should return a single proposal', async () => {
      const response = await request(app.getHttpServer())
        .get(`/dao/proposals/${testProposal.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testProposal.id);
      expect(response.body.title).toBe(testProposal.title);
      expect(response.body).toHaveProperty('voteCount');
    });

    it('should return 404 for non-existent proposal', async () => {
      await request(app.getHttpServer())
        .get('/dao/proposals/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /dao/proposals', () => {
    it('should create a new proposal', async () => {
      const createDto = {
        title: 'New Test Proposal',
        description: 'A new test proposal',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/dao/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.title).toBe(createDto.title);
      expect(response.body.status).toBe(ProposalStatus.DRAFT);
    });

    it('should create an active proposal when activateImmediately is true', async () => {
      const createDto = {
        title: 'Immediately Active Proposal',
        description: 'An immediately active proposal',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        activateImmediately: true,
      };

      const response = await request(app.getHttpServer())
        .post('/dao/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.status).toBe(ProposalStatus.ACTIVE);
    });

    it('should return 403 without Stellar wallet', async () => {
      const createDto = {
        title: 'Test Proposal',
        description: 'A test proposal',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      };

      await request(app.getHttpServer())
        .post('/dao/proposals')
        .set('Authorization', `Bearer ${authTokenWithoutWallet}`)
        .send(createDto)
        .expect(403);
    });
  });

  describe('PATCH /dao/proposals/:id/activate', () => {
    it('should activate a draft proposal', async () => {
      const draftProposal = await proposalRepository.save({
        title: 'Draft to Activate',
        description: 'A draft proposal to activate',
        status: ProposalStatus.DRAFT,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000 * 7),
        createdById: testUser.id,
      });

      const response = await request(app.getHttpServer())
        .patch(`/dao/proposals/${draftProposal.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe(ProposalStatus.ACTIVE);
    });

    it('should return 400 for non-draft proposal', async () => {
      await request(app.getHttpServer())
        .patch(`/dao/proposals/${testProposal.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });
});
