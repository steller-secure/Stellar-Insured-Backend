import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  ParsedContractEvent,
  ContractEventType,
  ProjectCreatedEvent,
  ContributionMadeEvent,
  MilestoneApprovedEvent,
  DividendClaimedEvent,
  FundsReleasedEvent,
} from '../types/event-types';
import {
  IEventHandler,
  IEventHandlerRegistry,
} from '../interfaces/event-handler.interface';
import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { DomainEventName } from '../../common/events/event-types';

class ProjectCreatedHandler implements IEventHandler {
  readonly eventType = ContractEventType.PROJECT_CREATED;
  private readonly logger = new Logger(ProjectCreatedHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as ProjectCreatedEvent;
    return !!(
      data.projectId !== undefined &&
      data.creator &&
      data.fundingGoal &&
      data.deadline &&
      data.token
    );
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as ProjectCreatedEvent;

    this.logger.log(
      `Processing PROJECT_CREATED: Project ${data.projectId} by ${data.creator}`,
    );

    const user = await this.prisma.user.upsert({
      where: { walletAddress: data.creator },
      update: {},
      create: {
        walletAddress: data.creator,
        reputationScore: 0,
      },
    });

    await this.prisma.project.upsert({
      where: { contractId: data.projectId.toString() },
      update: {
        title: `Project ${data.projectId}`,
        goal: BigInt(data.fundingGoal),
        deadline: new Date(data.deadline * 1000),
        status: 'ACTIVE',
      },
      create: {
        contractId: data.projectId.toString(),
        creatorId: user.id,
        title: `Project ${data.projectId}`,
        category: 'uncategorized',
        goal: BigInt(data.fundingGoal),
        deadline: new Date(data.deadline * 1000),
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Created/updated project ${data.projectId}`);
  }
}

class ContributionMadeHandler implements IEventHandler {
  readonly eventType = ContractEventType.CONTRIBUTION_MADE;
  private readonly logger = new Logger(ContributionMadeHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as ContributionMadeEvent;
    return !!(data.projectId !== undefined && data.contributor && data.amount);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as ContributionMadeEvent;

    this.logger.log(
      `Processing CONTRIBUTION_MADE: ${data.amount} to project ${data.projectId} from ${data.contributor}`,
    );

    const user = await this.prisma.user.upsert({
      where: { walletAddress: data.contributor },
      update: {},
      create: {
        walletAddress: data.contributor,
        reputationScore: 0,
      },
    });

    const project = await this.prisma.project.findUnique({
      where: { contractId: data.projectId.toString() },
    });

    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for contribution`);
      return;
    }

    await this.prisma.contribution.upsert({
      where: { transactionHash: event.transactionHash },
      update: {},
      create: {
        transactionHash: event.transactionHash,
        investorId: user.id,
        projectId: project.id,
        amount: BigInt(data.amount),
        timestamp: event.ledgerClosedAt,
      },
    });

    await this.prisma.project.update({
      where: { id: project.id },
      data: {
        currentFunds: BigInt(data.totalRaised),
      },
    });

    await this.eventBus.emit(DomainEventName.INDEXER_CONTRIBUTION_MADE, {
      userId: user.id,
      projectId: project.id,
      projectTitle: project.title,
      amount: data.amount,
      transactionHash: event.transactionHash,
    });

    this.logger.log(
      `Recorded contribution of ${data.amount} for project ${data.projectId}`,
    );
  }
}

class MilestoneApprovedHandler implements IEventHandler {
  readonly eventType = ContractEventType.MILESTONE_APPROVED;
  private readonly logger = new Logger(MilestoneApprovedHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as MilestoneApprovedEvent;
    return !!(data.projectId !== undefined && data.milestoneId !== undefined);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as MilestoneApprovedEvent;
    const milestoneId = data.milestoneId;
    const approvalCount = data.approvalCount;

    this.logger.log(
      `Processing MILESTONE_APPROVED: Milestone ${milestoneId} for project ${data.projectId} (approvals: ${approvalCount})`,
    );

    const project = await this.prisma.project.findUnique({
      where: { contractId: data.projectId.toString() },
    });

    if (!project) {
      this.logger.warn(
        `Project ${data.projectId} not found for milestone approval`,
      );
      return;
    }

    await this.prisma.milestone.updateMany({
      where: {
        projectId: project.id,
      },
      data: {
        status: 'APPROVED',
      },
    });

    const contributors = await this.prisma.contribution.findMany({
      where: { projectId: project.id },
      select: { investorId: true },
      distinct: ['investorId'],
    });

    const investorIds = contributors.map(c => c.investorId);

    await this.eventBus.emit(DomainEventName.INDEXER_MILESTONE_APPROVED, {
      projectId: project.id,
      projectTitle: project.title,
      milestoneId: data.milestoneId,
      creatorId: project.creatorId ?? undefined,
      investorIds,
    });

    this.logger.log(`Approved milestone for project ${data.projectId}`);
  }
}

class MilestoneRejectedHandler implements IEventHandler {
  readonly eventType = ContractEventType.MILESTONE_REJECTED;
  private readonly logger = new Logger(MilestoneRejectedHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as any;
    return !!(data.projectId !== undefined && data.milestoneId !== undefined);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as any;

    this.logger.log(
      `Processing MILESTONE_REJECTED: Milestone ${data.milestoneId} for project ${data.projectId}`,
    );

    const project = await this.prisma.project.findUnique({
      where: { contractId: data.projectId.toString() },
    });

    if (!project) {
      this.logger.warn(
        `Project ${data.projectId} not found for milestone rejection`,
      );
      return;
    }

    await this.prisma.milestone.updateMany({
      where: {
        projectId: project.id,
      },
      data: {
        status: 'REJECTED',
      },
    });

    const contributors = await this.prisma.contribution.findMany({
      where: { projectId: project.id },
      select: { investorId: true },
      distinct: ['investorId'],
    });

    const investorIds = contributors.map(c => c.investorId);

    await this.eventBus.emit(DomainEventName.INDEXER_MILESTONE_REJECTED, {
      projectId: project.id,
      projectTitle: project.title,
      milestoneId: data.milestoneId,
      creatorId: project.creatorId ?? undefined,
      investorIds,
    });
  }
}

class FundsReleasedHandler implements IEventHandler {
  readonly eventType = ContractEventType.FUNDS_RELEASED;
  private readonly logger = new Logger(FundsReleasedHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as FundsReleasedEvent;
    return !!(data.projectId !== undefined && data.amount);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as FundsReleasedEvent;

    this.logger.log(
      `Processing FUNDS_RELEASED: ${data.amount} for project ${data.projectId}, milestone ${data.milestoneId}`,
    );

    const project = await this.prisma.project.findUnique({
      where: { contractId: data.projectId.toString() },
    });

    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for funds release`);
      return;
    }

    await this.prisma.milestone.updateMany({
      where: {
        projectId: project.id,
      },
      data: {
        status: 'FUNDED',
        completionDate: event.ledgerClosedAt,
      },
    });

    this.logger.log(`Released funds for project ${data.projectId}`);
  }
}

class ProjectCompletedHandler implements IEventHandler {
  readonly eventType = ContractEventType.PROJECT_COMPLETED;
  private readonly logger = new Logger(ProjectCompletedHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as any;
    return data.projectId !== undefined;
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as any;

    this.logger.log(`Processing PROJECT_COMPLETED: Project ${data.projectId}`);

    await this.prisma.project.updateMany({
      where: { contractId: data.projectId.toString() },
      data: { status: 'COMPLETED' },
    });

    this.logger.log(`Marked project ${data.projectId} as completed`);
  }
}

class ProjectFailedHandler implements IEventHandler {
  readonly eventType = ContractEventType.PROJECT_FAILED;
  private readonly logger = new Logger(ProjectFailedHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as any;
    return data.projectId !== undefined;
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as any;

    this.logger.log(`Processing PROJECT_FAILED: Project ${data.projectId}`);

    await this.prisma.project.updateMany({
      where: { contractId: data.projectId.toString() },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Marked project ${data.projectId} as failed/cancelled`);
  }
}

class DividendClaimedHandler implements IEventHandler {
  readonly eventType = ContractEventType.DIVIDEND_CLAIMED;
  private readonly logger = new Logger(DividendClaimedHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as DividendClaimedEvent;
    return !!(data.poolId && data.claimer && data.amount);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as DividendClaimedEvent;

    this.logger.log(
      `Processing DIVIDEND_CLAIMED: ${data.amount} from pool ${data.poolId} claimed by ${data.claimer}`,
    );

    const user = await this.prisma.user.upsert({
      where: { walletAddress: data.claimer },
      update: {},
      create: {
        walletAddress: data.claimer,
        reputationScore: 0,
      },
    });

    await this.eventBus.emit(DomainEventName.INDEXER_DIVIDEND_CLAIMED, {
      userId: user.id,
      poolId: data.poolId,
      amount: data.amount,
    });

    this.logger.log(`Emitted dividend claimed event for ${user.id}`);
  }
}

@Injectable()
export class EventHandlerService implements IEventHandlerRegistry {
  private readonly logger = new Logger(EventHandlerService.name);
  private readonly handlers = new Map<string, IEventHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(new ProjectCreatedHandler(this.prisma));
    this.register(new ContributionMadeHandler(this.prisma, this.eventBus));
    this.register(new MilestoneApprovedHandler(this.prisma, this.eventBus));
    this.register(new MilestoneRejectedHandler(this.prisma, this.eventBus));
    this.register(new FundsReleasedHandler(this.prisma));
    this.register(new ProjectCompletedHandler(this.prisma));
    this.register(new ProjectFailedHandler(this.prisma));
    this.register(new DividendClaimedHandler(this.prisma, this.eventBus));

    this.logger.log(`Registered ${this.handlers.size} event handlers`);
  }

  register(handler: IEventHandler): void {
    this.handlers.set(handler.eventType, handler);
    this.logger.debug(`Registered handler for ${handler.eventType}`);
  }

  getHandler(eventType: string): IEventHandler | undefined {
    return this.handlers.get(eventType);
  }

  getAllHandlers(): IEventHandler[] {
    return Array.from(this.handlers.values());
  }

  async processEvent(event: ParsedContractEvent): Promise<boolean> {
    const handler = this.getHandler(event.eventType);

    if (!handler) {
      this.logger.debug(
        `No handler registered for event type: ${event.eventType}`,
      );
      return false;
    }

    try {
      if (!handler.validate(event)) {
        this.logger.warn(`Event validation failed for ${event.eventType}`);
        return false;
      }

      await handler.handle(event);
      return true;
    } catch (error) {
      this.logger.error(
        `Error processing event ${event.eventType}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  isSupported(eventType: string): boolean {
    return this.handlers.has(eventType);
  }
}
