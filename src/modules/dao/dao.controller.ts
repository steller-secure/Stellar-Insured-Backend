import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiHeader,
} from '@nestjs/swagger';
import { DaoService } from './dao.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DaoMemberGuard } from './guards/dao-member.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Idempotent } from 'src/common/idempotency';
import {
  CreateProposalDto,
  CastVoteDto,
  ProposalListQueryDto,
  ProposalListResponseDto,
  ProposalResponseDto,
  VoteResultDto,
} from './dto';
import { Vote } from './entities/vote.entity';

@ApiTags('DAO')
@Controller('dao')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DaoController {
  constructor(private readonly daoService: DaoService) {}

  @Post('proposals')
  @UseGuards(DaoMemberGuard)
  @ApiOperation({ summary: 'Create a new proposal' })
  @ApiResponse({
    status: 201,
    description: 'Proposal created successfully',
    type: ProposalResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Stellar wallet required' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique identifier for idempotent requests (required)',
    required: true,
  })
  @Idempotent()
  async createProposal(
    @Body() createProposalDto: CreateProposalDto,
    @CurrentUser() user: User,
  ): Promise<ProposalResponseDto> {
    return this.daoService.createProposal(createProposalDto, user);
  }

  @Get('proposals')
  @ApiOperation({ summary: 'Get all proposals with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of proposals',
    type: ProposalListResponseDto,
  })
  async getProposals(
    @Query() queryDto: ProposalListQueryDto,
  ): Promise<ProposalListResponseDto> {
    return this.daoService.getProposals(queryDto);
  }

  @Get('proposals/:id')
  @ApiOperation({ summary: 'Get a proposal by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Proposal details',
    type: ProposalResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  async getProposal(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProposalResponseDto> {
    return this.daoService.getProposalById(id);
  }

  @Post('proposals/:id/vote')
  @UseGuards(DaoMemberGuard)
  @ApiOperation({ summary: 'Cast a vote on a proposal' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Vote cast successfully',
    type: Vote,
  })
  @ApiResponse({ status: 400, description: 'Invalid vote or proposal expired' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Stellar wallet required' })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  @ApiResponse({ status: 409, description: 'Duplicate vote' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique identifier for idempotent requests (required)',
    required: true,
  })
  @Idempotent()
  async castVote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() castVoteDto: CastVoteDto,
    @CurrentUser() user: User,
  ): Promise<Vote> {
    return this.daoService.castVote(id, castVoteDto, user);
  }

  @Get('proposals/:id/results')
  @ApiOperation({ summary: 'Get voting results for a proposal' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Voting results',
    type: VoteResultDto,
  })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  async getProposalResults(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VoteResultDto> {
    return this.daoService.getProposalResults(id);
  }

  @Patch('proposals/:id/activate')
  @UseGuards(DaoMemberGuard)
  @ApiOperation({ summary: 'Activate a draft proposal' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Proposal activated',
    type: ProposalResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Proposal not in draft status' })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique identifier for idempotent requests (required)',
    required: true,
  })
  @Idempotent()
  async activateProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ProposalResponseDto> {
    return this.daoService.activateProposal(id, user);
  }
}
