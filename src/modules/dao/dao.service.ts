import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Proposal } from './entities/proposal.entity';
import { Vote } from './entities/vote.entity';
import { User } from '../users/entities/user.entity';
import { ProposalStatus } from './enums/proposal-status.enum';
import { VoteType } from './enums/vote-type.enum';
import {
  CreateProposalDto,
  CastVoteDto,
  ProposalListQueryDto,
  ProposalListResponseDto,
  ProposalResponseDto,
  VoteResultDto,
} from './dto';
import {
  ProposalNotFoundException,
  ProposalExpiredException,
  DuplicateVoteException,
  VotingNotStartedException,
  InvalidProposalStatusException,
} from './exceptions';

@Injectable()
export class DaoService {
  // Minimum votes required for a proposal to be valid
  private readonly QUORUM_THRESHOLD = 10;

  constructor(
    @InjectRepository(Proposal)
    private readonly proposalRepository: Repository<Proposal>,
    @InjectRepository(Vote)
    private readonly voteRepository: Repository<Vote>,
    private readonly dataSource: DataSource,
  ) {}

  async createProposal(
    createProposalDto: CreateProposalDto,
    user: User,
  ): Promise<ProposalResponseDto> {
    const { title, description, startDate, endDate, activateImmediately } =
      createProposalDto;

    const proposal = this.proposalRepository.create({
      title,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: activateImmediately
        ? ProposalStatus.ACTIVE
        : ProposalStatus.DRAFT,
      createdById: user.id,
    });

    const savedProposal = await this.proposalRepository.save(proposal);

    return this.toProposalResponse(savedProposal);
  }

  async getProposals(
    queryDto: ProposalListQueryDto,
  ): Promise<ProposalListResponseDto> {
    const { status, page = 1, limit = 10 } = queryDto;

    const queryBuilder = this.proposalRepository
      .createQueryBuilder('proposal')
      .leftJoin('proposal.votes', 'vote')
      .addSelect('COUNT(vote.id)', 'voteCount')
      .groupBy('proposal.id')
      .orderBy('proposal.createdAt', 'DESC');

    if (status) {
      queryBuilder.where('proposal.status = :status', { status });
    }

    const total = await this.proposalRepository.count({
      where: status ? { status } : undefined,
    });

    const proposals = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

    const proposalsWithCount = proposals.entities.map((proposal, index) => ({
      ...this.toProposalResponse(proposal),
      voteCount: parseInt(proposals.raw[index]?.voteCount || '0', 10),
    }));

    return {
      proposals: proposalsWithCount,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProposalById(id: string): Promise<ProposalResponseDto> {
    const proposal = await this.proposalRepository.findOne({
      where: { id },
    });

    if (!proposal) {
      throw new ProposalNotFoundException(id);
    }

    const voteCount = await this.voteRepository.count({
      where: { proposalId: id },
    });

    return {
      ...this.toProposalResponse(proposal),
      voteCount,
    };
  }

  async castVote(
    proposalId: string,
    castVoteDto: CastVoteDto,
    user: User,
  ): Promise<Vote> {
    const walletAddress = user.walletAddress;

    // Use a transaction with pessimistic locking to prevent race conditions
    return this.dataSource.transaction(async manager => {
      // Lock the proposal row to prevent concurrent modifications
      const proposal = await manager.findOne(Proposal, {
        where: { id: proposalId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!proposal) {
        throw new ProposalNotFoundException(proposalId);
      }

      // Validate proposal status
      if (proposal.status !== ProposalStatus.ACTIVE) {
        throw new InvalidProposalStatusException(proposalId, proposal.status);
      }

      // Validate voting window
      const now = new Date();
      if (now < proposal.startDate) {
        throw new VotingNotStartedException(proposalId);
      }
      if (now > proposal.endDate) {
        throw new ProposalExpiredException(proposalId);
      }

      // Check for duplicate vote (one-wallet-one-vote)
      const existingVote = await manager.findOne(Vote, {
        where: { proposalId, walletAddress },
      });

      if (existingVote) {
        throw new DuplicateVoteException(walletAddress, proposalId);
      }

      // Create and save the vote
      const vote = manager.create(Vote, {
        proposalId,
        userId: user.id,
        walletAddress,
        voteType: castVoteDto.voteType,
      });

      return manager.save(vote);
    });
  }

  async getProposalResults(proposalId: string): Promise<VoteResultDto> {
    const proposal = await this.proposalRepository.findOne({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new ProposalNotFoundException(proposalId);
    }

    // Aggregate vote counts by type
    const voteCounts = await this.voteRepository
      .createQueryBuilder('vote')
      .select('vote.voteType', 'voteType')
      .addSelect('COUNT(*)', 'count')
      .where('vote.proposalId = :proposalId', { proposalId })
      .groupBy('vote.voteType')
      .getRawMany<{ voteType: VoteType; count: string }>();

    // Initialize counts
    let forVotes = 0;
    let againstVotes = 0;
    let abstainVotes = 0;

    // Parse the aggregated results
    for (const result of voteCounts) {
      const count = parseInt(result.count, 10);
      switch (result.voteType) {
        case VoteType.FOR:
          forVotes = count;
          break;
        case VoteType.AGAINST:
          againstVotes = count;
          break;
        case VoteType.ABSTAIN:
          abstainVotes = count;
          break;
      }
    }

    const totalVotes = forVotes + againstVotes + abstainVotes;

    // Calculate percentages (avoid division by zero)
    const percentages = {
      for:
        totalVotes > 0 ? Number(((forVotes / totalVotes) * 100).toFixed(2)) : 0,
      against:
        totalVotes > 0
          ? Number(((againstVotes / totalVotes) * 100).toFixed(2))
          : 0,
      abstain:
        totalVotes > 0
          ? Number(((abstainVotes / totalVotes) * 100).toFixed(2))
          : 0,
    };

    return {
      proposalId,
      totalVotes,
      forVotes,
      againstVotes,
      abstainVotes,
      percentages,
      hasQuorum: totalVotes >= this.QUORUM_THRESHOLD,
      quorumThreshold: this.QUORUM_THRESHOLD,
    };
  }

  async activateProposal(id: string, _user: User): Promise<ProposalResponseDto> {
    const proposal = await this.proposalRepository.findOne({
      where: { id },
    });

    if (!proposal) {
      throw new ProposalNotFoundException(id);
    }

    if (proposal.status !== ProposalStatus.DRAFT) {
      throw new InvalidProposalStatusException(id, proposal.status);
    }

    proposal.status = ProposalStatus.ACTIVE;
    const updatedProposal = await this.proposalRepository.save(proposal);

    return this.toProposalResponse(updatedProposal);
  }

  private toProposalResponse(proposal: Proposal): ProposalResponseDto {
    return {
      id: proposal.id,
      title: proposal.title,
      description: proposal.description,
      status: proposal.status,
      startDate: proposal.startDate,
      endDate: proposal.endDate,
      onChainId: proposal.onChainId,
      transactionHash: proposal.transactionHash,
      createdById: proposal.createdById,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
    };
  }
}
