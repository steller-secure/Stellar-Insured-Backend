import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { DaoService } from './dao.service';
import { Proposal } from './entities/proposal.entity';
import { Vote } from './entities/vote.entity';
import { User, UserStatus, UserRole, SignupSource } from '../users/entities/user.entity';
import { ProposalStatus } from './enums/proposal-status.enum';
import { VoteType } from './enums/vote-type.enum';
import { CreateProposalDto, CastVoteDto } from './dto';
import {
  ProposalNotFoundException,
  ProposalExpiredException,
  DuplicateVoteException,
  VotingNotStartedException,
  InvalidProposalStatusException,
} from './exceptions';

describe('DaoService', () => {
  let service: DaoService;
  let proposalRepository: jest.Mocked<Repository<Proposal>>;
  let voteRepository: jest.Mocked<Repository<Vote>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUser: User = {
    id: 'user-uuid',
    walletAddress: 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    email: 'test@example.com',
    status: UserStatus.ACTIVE,
    roles: [UserRole.USER],
    signupSource: SignupSource.ORGANIC,
    isEmailVerified: false,
    isWalletVerified: false,
    kycVerified: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    votes: [],
    proposals: [],
    policies: [],
    claims: [],
    payments: [],
  };

  const mockProposal: Proposal = {
    id: 'proposal-uuid',
    title: 'Test Proposal',
    description: 'Test Description',
    status: ProposalStatus.ACTIVE,
    startDate: new Date(Date.now() - 86400000), // Yesterday
    endDate: new Date(Date.now() + 86400000), // Tomorrow
    onChainId: null,
    transactionHash: null,
    createdById: mockUser.id,
    createdBy: mockUser,
    votes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockQueryBuilder = () => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
  });

  beforeEach(async () => {
    const mockQueryBuilder = createMockQueryBuilder();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DaoService,
        {
          provide: getRepositoryToken(Proposal),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Vote),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DaoService>(DaoService);
    proposalRepository = module.get(getRepositoryToken(Proposal));
    voteRepository = module.get(getRepositoryToken(Vote));
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProposal', () => {
    const createProposalDto: CreateProposalDto = {
      title: 'New Proposal',
      description: 'A new proposal description',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 604800000).toISOString(), // 1 week from now
    };

    it('should create a proposal with DRAFT status by default', async () => {
      const savedProposal = {
        ...mockProposal,
        status: ProposalStatus.DRAFT,
      };

      proposalRepository.create.mockReturnValue(savedProposal);
      proposalRepository.save.mockResolvedValue(savedProposal);

      const result = await service.createProposal(createProposalDto, mockUser);

      expect(result.status).toBe(ProposalStatus.DRAFT);
      expect(proposalRepository.create).toHaveBeenCalled();
      expect(proposalRepository.save).toHaveBeenCalled();
    });

    it('should create a proposal with ACTIVE status when activateImmediately is true', async () => {
      const dto: CreateProposalDto = {
        ...createProposalDto,
        activateImmediately: true,
      };
      const savedProposal = {
        ...mockProposal,
        status: ProposalStatus.ACTIVE,
      };

      proposalRepository.create.mockReturnValue(savedProposal);
      proposalRepository.save.mockResolvedValue(savedProposal);

      const result = await service.createProposal(dto, mockUser);

      expect(result.status).toBe(ProposalStatus.ACTIVE);
    });
  });

  describe('getProposalById', () => {
    it('should return a proposal with vote count', async () => {
      proposalRepository.findOne.mockResolvedValue(mockProposal);
      voteRepository.count.mockResolvedValue(5);

      const result = await service.getProposalById(mockProposal.id);

      expect(result.id).toBe(mockProposal.id);
      expect(result.voteCount).toBe(5);
    });

    it('should throw ProposalNotFoundException when proposal does not exist', async () => {
      proposalRepository.findOne.mockResolvedValue(null);

      await expect(service.getProposalById('non-existent-id')).rejects.toThrow(
        ProposalNotFoundException,
      );
    });
  });

  describe('castVote', () => {
    const castVoteDto: CastVoteDto = {
      voteType: VoteType.FOR,
    };

    it('should cast a vote successfully', async () => {
      const mockVote: Vote = {
        id: 'vote-uuid',
        proposalId: mockProposal.id,
        proposal: mockProposal,
        userId: mockUser.id,
        user: mockUser,
        walletAddress: mockUser.walletAddress,
        voteType: VoteType.FOR,
        transactionHash: null,
        createdAt: new Date(),
      };

      const mockManager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(mockProposal) // First call for proposal
          .mockResolvedValueOnce(null), // Second call for existing vote
        create: jest.fn().mockReturnValue(mockVote),
        save: jest.fn().mockResolvedValue(mockVote),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      const result = await service.castVote(
        mockProposal.id,
        castVoteDto,
        mockUser,
      );

      expect(result.voteType).toBe(VoteType.FOR);
      expect(mockManager.findOne).toHaveBeenCalledTimes(2);
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('should throw ProposalNotFoundException when proposal does not exist', async () => {
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      await expect(
        service.castVote('non-existent-id', castVoteDto, mockUser),
      ).rejects.toThrow(ProposalNotFoundException);
    });

    it('should throw InvalidProposalStatusException when proposal is not ACTIVE', async () => {
      const draftProposal = {
        ...mockProposal,
        status: ProposalStatus.DRAFT,
      };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(draftProposal),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      await expect(
        service.castVote(mockProposal.id, castVoteDto, mockUser),
      ).rejects.toThrow(InvalidProposalStatusException);
    });

    it('should throw VotingNotStartedException when voting has not started', async () => {
      const futureProposal = {
        ...mockProposal,
        startDate: new Date(Date.now() + 86400000), // Tomorrow
      };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(futureProposal),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      await expect(
        service.castVote(mockProposal.id, castVoteDto, mockUser),
      ).rejects.toThrow(VotingNotStartedException);
    });

    it('should throw ProposalExpiredException when voting has ended', async () => {
      const expiredProposal = {
        ...mockProposal,
        endDate: new Date(Date.now() - 86400000), // Yesterday
      };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(expiredProposal),
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      await expect(
        service.castVote(mockProposal.id, castVoteDto, mockUser),
      ).rejects.toThrow(ProposalExpiredException);
    });

    it('should throw DuplicateVoteException when user has already voted', async () => {
      const existingVote: Vote = {
        id: 'existing-vote-uuid',
        proposalId: mockProposal.id,
        proposal: mockProposal,
        userId: mockUser.id,
        user: mockUser,
        walletAddress: mockUser.walletAddress,
        voteType: VoteType.FOR,
        transactionHash: null,
        createdAt: new Date(),
      };

      const mockManager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(mockProposal) // First call for proposal
          .mockResolvedValueOnce(existingVote), // Second call for existing vote
      };

      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(mockManager),
      );

      await expect(
        service.castVote(mockProposal.id, castVoteDto, mockUser),
      ).rejects.toThrow(DuplicateVoteException);
    });
  });

  describe('getProposalResults', () => {
    it('should return aggregated voting results', async () => {
      proposalRepository.findOne.mockResolvedValue(mockProposal);

      const mockVoteCounts = [
        { voteType: VoteType.FOR, count: '10' },
        { voteType: VoteType.AGAINST, count: '3' },
        { voteType: VoteType.ABSTAIN, count: '2' },
      ];

      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getRawMany.mockResolvedValue(mockVoteCounts);
      voteRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as SelectQueryBuilder<Vote>,
      );

      const result = await service.getProposalResults(mockProposal.id);

      expect(result.proposalId).toBe(mockProposal.id);
      expect(result.totalVotes).toBe(15);
      expect(result.forVotes).toBe(10);
      expect(result.againstVotes).toBe(3);
      expect(result.abstainVotes).toBe(2);
      expect(result.hasQuorum).toBe(true);
      expect(result.percentages.for).toBeCloseTo(66.67, 1);
      expect(result.percentages.against).toBeCloseTo(20, 1);
      expect(result.percentages.abstain).toBeCloseTo(13.33, 1);
    });

    it('should return zero percentages when there are no votes', async () => {
      proposalRepository.findOne.mockResolvedValue(mockProposal);

      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      voteRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as SelectQueryBuilder<Vote>,
      );

      const result = await service.getProposalResults(mockProposal.id);

      expect(result.totalVotes).toBe(0);
      expect(result.hasQuorum).toBe(false);
      expect(result.percentages.for).toBe(0);
      expect(result.percentages.against).toBe(0);
      expect(result.percentages.abstain).toBe(0);
    });

    it('should throw ProposalNotFoundException when proposal does not exist', async () => {
      proposalRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getProposalResults('non-existent-id'),
      ).rejects.toThrow(ProposalNotFoundException);
    });
  });

  describe('activateProposal', () => {
    it('should activate a draft proposal', async () => {
      const draftProposal = {
        ...mockProposal,
        status: ProposalStatus.DRAFT,
      };

      proposalRepository.findOne.mockResolvedValue(draftProposal);
      proposalRepository.save.mockResolvedValue({
        ...draftProposal,
        status: ProposalStatus.ACTIVE,
      });

      const result = await service.activateProposal(mockProposal.id, mockUser);

      expect(result.status).toBe(ProposalStatus.ACTIVE);
    });

    it('should throw ProposalNotFoundException when proposal does not exist', async () => {
      proposalRepository.findOne.mockResolvedValue(null);

      await expect(
        service.activateProposal('non-existent-id', mockUser),
      ).rejects.toThrow(ProposalNotFoundException);
    });

    it('should throw InvalidProposalStatusException when proposal is not in DRAFT status', async () => {
      proposalRepository.findOne.mockResolvedValue(mockProposal); // mockProposal has ACTIVE status

      await expect(
        service.activateProposal(mockProposal.id, mockUser),
      ).rejects.toThrow(InvalidProposalStatusException);
    });
  });
});
