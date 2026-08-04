import { Injectable, Logger } from '@nestjs/common';
import {
  ParsedContractEvent,
  ContractEventType,
  ProjectCreatedEvent,
  ContributionMadeEvent,
  MilestoneApprovedEvent,
  MilestoneRejectedEvent,
  ProjectStatusEvent,
  DividendClaimedEvent,
  FundsReleasedEvent,
} from '../types/event-types';
import { IEventHandler, IEventHandlerRegistry } from '../interfaces/event-handler.interface';
import { NotificationService } from '../../notification/services/notification.service';
import { ReputationService } from '../../reputation/reputation.service';
import { REPUTATION_DELTAS } from '../../reputation/reputation.constants';
import { NotificationType } from '../../notification/enums/notification-type.enum';
import {
  UserRepository,
  ProjectRepository,
  ContributionRepository,
  MilestoneRepository,
} from '../../common/repositories';
import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { DomainEventName } from '../../common/events/event-types';

// ─── ProjectCreatedHandler ────────────────────────────────────────────────────
import { updateTracingContext } from '../../common/tracing/tracing-context';

class ProjectCreatedHandler implements IEventHandler {
  readonly eventType = ContractEventType.PROJECT_CREATED;
  private readonly logger = new Logger(ProjectCreatedHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly projectRepository: ProjectRepository,
  ) {}

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
    this.logger.log(`Processing PROJECT_CREATED: Project ${data.projectId} by ${data.creator}`);

    const user = await this.userRepository.upsertByWallet(
      data.creator,
      { walletAddress: data.creator, reputationScore: 0 },
      {},
    );

    const project = await this.projectRepository.upsertByContractId(
      data.projectId.toString(),
      {
        contractId: data.projectId.toString(),
        creatorId: user.id,
        title: `Project ${data.projectId}`,
        category: 'uncategorized',
        goal: BigInt(data.fundingGoal),
        deadline: new Date(data.deadline * 1000),
        status: 'ACTIVE',
      },
      {
        title: `Project ${data.projectId}`,
        category: 'uncategorized',
        goal: BigInt(data.fundingGoal),
        deadline: new Date(data.deadline * 1000),
        status: 'ACTIVE',
      },
    );
    updateTracingContext({ entityId: project.id });

    this.logger.log(`Created/updated project ${data.projectId}`);
  }
}

// ─── ContributionMadeHandler ──────────────────────────────────────────────────

class ContributionMadeHandler implements IEventHandler {
  readonly eventType = ContractEventType.CONTRIBUTION_MADE;
  private readonly logger = new Logger(ContributionMadeHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly contributionRepository: ContributionRepository,
    private readonly notificationService: NotificationService,
    private readonly reputationService: ReputationService,
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

    const user = await this.userRepository.upsertByWallet(
      data.contributor,
      { walletAddress: data.contributor, reputationScore: 0 },
      {},
    );

    const project = await this.projectRepository.findByContractId(data.projectId.toString());
    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for contribution`);
      return;
    }
    updateTracingContext({ entityId: project.id });

    await this.contributionRepository.upsertByTxHash(event.transactionHash, {
      transactionHash: event.transactionHash,
      investorId: user.id,
      projectId: project.id,
      amount: BigInt(data.amount),
      timestamp: event.ledgerClosedAt,
    });

    await this.projectRepository.updateById(project.id, {
      currentFunds: BigInt(data.totalRaised),
    });

    await this.eventBus.emit(DomainEventName.INDEXER_CONTRIBUTION_MADE, {
      userId: user.id,
      projectId: project.id,
      projectTitle: project.title,
      amount: data.amount,
      transactionHash: event.transactionHash,
    });

    try {
      await this.notificationService.notify(
        user.id,
        NotificationType.CONTRIBUTION,
        'Contribution Successful!',
        `Your contribution of ${data.amount} to project ${project.title} was successful.`,
        { projectId: project.id, amount: data.amount },
      );
    } catch (e) {
      this.logger.error(
        `Failed to send contribution notification to user ${user.id}: ${e.message}`,
      );
    }

    try {
      await this.reputationService.adjustReputation(
        user.id,
        REPUTATION_DELTAS.CONTRIBUTION_SUCCESS,
        `Contribution of ${data.amount} to project ${data.projectId} recorded on-chain`,
      );
    } catch (e) {
      this.logger.error(
        `Failed to adjust reputation for contribution by user ${user.id}: ${e.message}`,
      );
    }

    this.logger.log(`Recorded contribution of ${data.amount} for project ${data.projectId}`);
  }
}

// ─── MilestoneApprovedHandler ─────────────────────────────────────────────────

class MilestoneApprovedHandler implements IEventHandler {
  readonly eventType = ContractEventType.MILESTONE_APPROVED;
  private readonly logger = new Logger(MilestoneApprovedHandler.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly milestoneRepository: MilestoneRepository,
    private readonly contributionRepository: ContributionRepository,
    private readonly notificationService: NotificationService,
    private readonly reputationService: ReputationService,
    private readonly eventBus: DomainEventBus,
  ) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as MilestoneApprovedEvent;
    return !!(data.projectId !== undefined && data.milestoneId !== undefined);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as MilestoneApprovedEvent;
    this.logger.log(
      `Processing MILESTONE_APPROVED: Milestone ${data.milestoneId} for project ${data.projectId}`,
    );

    const project = await this.projectRepository.findByContractId(data.projectId.toString());
    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for milestone approval`);
      return;
    }
    updateTracingContext({ entityId: project.id });

    await this.milestoneRepository.updateManyByProject(project.id, { status: 'APPROVED' });

    const contributors = await this.contributionRepository.findDistinctInvestors(project.id);

    for (const { investorId } of contributors) {
      try {
        await this.notificationService.notify(
          investorId,
          NotificationType.MILESTONE,
          'Project Milestone Reached!',
          `A project you back (${project.title}) has reached a new milestone!`,
          { projectId: project.id, milestoneId: data.milestoneId },
        );
      } catch (e) {
        this.logger.error(
          `Failed to notify investor ${investorId} of milestone: ${e.message}`,
        );
      }
    }

    if (project.creatorId) {
      await this.reputationService.updateTrustScore(project.creatorId);
      try {
        await this.reputationService.adjustReputation(
          project.creatorId,
          REPUTATION_DELTAS.MILESTONE_APPROVED,
          `Milestone ${data.milestoneId} approved for project ${data.projectId}`,
        );
      } catch (e) {
        this.logger.error(
          `Failed to adjust reputation for milestone approval, creator ${project.creatorId}: ${e.message}`,
        );
      }
    }
  }
}

// ─── MilestoneRejectedHandler ─────────────────────────────────────────────────

class MilestoneRejectedHandler implements IEventHandler {
  readonly eventType = ContractEventType.MILESTONE_REJECTED;
  private readonly logger = new Logger(MilestoneRejectedHandler.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly milestoneRepository: MilestoneRepository,
    private readonly contributionRepository: ContributionRepository,
    private readonly notificationService: NotificationService,
    private readonly reputationService: ReputationService,
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

    const project = await this.projectRepository.findByContractId(data.projectId.toString());
    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for milestone rejection`);
      return;
    }
    updateTracingContext({ entityId: project.id });

    await this.milestoneRepository.updateManyByProject(project.id, { status: 'REJECTED' });

    const contributors = await this.contributionRepository.findDistinctInvestors(project.id);

    for (const { investorId } of contributors) {
      try {
        await this.notificationService.notify(
          investorId,
          NotificationType.MILESTONE,
          'Project Milestone Failed',
          `A project you back (${project.title}) has a failed milestone!`,
          { projectId: project.id, milestoneId: data.milestoneId },
        );
      } catch (e) {
        this.logger.error(
          `Failed to notify investor ${investorId} of milestone: ${e.message}`,
        );
      }
    }

    if (project.creatorId) {
      await this.reputationService.updateTrustScore(project.creatorId);
      try {
        await this.reputationService.adjustReputation(
          project.creatorId,
          REPUTATION_DELTAS.MILESTONE_REJECTED,
          `Milestone ${data.milestoneId} rejected for project ${data.projectId}`,
        );
      } catch (e) {
        this.logger.error(
          `Failed to adjust reputation for milestone rejection, creator ${project.creatorId}: ${e.message}`,
        );
      }
    }
  }
}

// ─── FundsReleasedHandler ─────────────────────────────────────────────────────

class FundsReleasedHandler implements IEventHandler {
  readonly eventType = ContractEventType.FUNDS_RELEASED;
  private readonly logger = new Logger(FundsReleasedHandler.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly milestoneRepository: MilestoneRepository,
  ) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as FundsReleasedEvent;
    return !!(data.projectId !== undefined && data.amount);
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as FundsReleasedEvent;
    this.logger.log(
      `Processing FUNDS_RELEASED: ${data.amount} for project ${data.projectId}, milestone ${data.milestoneId}`,
    );

    const project = await this.projectRepository.findByContractId(data.projectId.toString());
    if (!project) {
      this.logger.warn(`Project ${data.projectId} not found for funds release`);
      return;
    }
    updateTracingContext({ entityId: project.id });

    await this.milestoneRepository.updateManyByProject(project.id, {
      status: 'FUNDED',
      completionDate: event.ledgerClosedAt,
    });

    this.logger.log(`Released funds for project ${data.projectId}`);
  }
}

// ─── ProjectCompletedHandler ──────────────────────────────────────────────────

class ProjectCompletedHandler implements IEventHandler {
  readonly eventType = ContractEventType.PROJECT_COMPLETED;
  private readonly logger = new Logger(ProjectCompletedHandler.name);

  constructor(private readonly projectRepository: ProjectRepository) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as ProjectStatusEvent;
    return data.projectId !== undefined;
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as ProjectStatusEvent;
    this.logger.log(`Processing PROJECT_COMPLETED: Project ${data.projectId}`);
    updateTracingContext({ entityId: data.projectId.toString() });
    await this.projectRepository.updateManyByContractId(data.projectId.toString(), {
      status: 'COMPLETED',
    });
    this.logger.log(`Marked project ${data.projectId} as completed`);
  }
}

// ─── ProjectFailedHandler ─────────────────────────────────────────────────────

class ProjectFailedHandler implements IEventHandler {
  readonly eventType = ContractEventType.PROJECT_FAILED;
  private readonly logger = new Logger(ProjectFailedHandler.name);

  constructor(private readonly projectRepository: ProjectRepository) {}

  validate(event: ParsedContractEvent): boolean {
    const data = event.data as unknown as ProjectStatusEvent;
    return data.projectId !== undefined;
  }

  async handle(event: ParsedContractEvent): Promise<void> {
    const data = event.data as unknown as ProjectStatusEvent;
    this.logger.log(`Processing PROJECT_FAILED: Project ${data.projectId}`);
    updateTracingContext({ entityId: data.projectId.toString() });
    await this.projectRepository.updateManyByContractId(data.projectId.toString(), {
      status: 'CANCELLED',
    });
    this.logger.log(`Marked project ${data.projectId} as failed/cancelled`);
  }
}

// ─── DividendClaimedHandler ───────────────────────────────────────────────────

class DividendClaimedHandler implements IEventHandler {
  readonly eventType = ContractEventType.DIVIDEND_CLAIMED;
  private readonly logger = new Logger(DividendClaimedHandler.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly reputationService: ReputationService,
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

    const user = await this.userRepository.upsertByWallet(
      data.claimer,
      { walletAddress: data.claimer, reputationScore: 0 },
      {},
    );
    updateTracingContext({ entityId: data.poolId, userId: user.id });

    await this.eventBus.emit(DomainEventName.INDEXER_DIVIDEND_CLAIMED, {
      userId: user.id,
      poolId: data.poolId,
      amount: data.amount,
    });
    await this.reputationService.updateTrustScore(user.id);
    this.logger.log(`Updated trust score for claimer ${user.id}`);
  }
}

// ─── EventHandlerService ──────────────────────────────────────────────────────

@Injectable()
export class EventHandlerService implements IEventHandlerRegistry {
  private readonly logger = new Logger(EventHandlerService.name);
  private readonly handlers = new Map<string, IEventHandler>();

  constructor(
    private readonly userRepository: UserRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly contributionRepository: ContributionRepository,
    private readonly milestoneRepository: MilestoneRepository,
    private readonly notificationService: NotificationService,
    private readonly reputationService: ReputationService,
    private readonly eventBus: DomainEventBus,
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(
      new ProjectCreatedHandler(this.userRepository, this.projectRepository),
    );
    this.register(
      new ContributionMadeHandler(
        this.userRepository,
        this.projectRepository,
        this.contributionRepository,
        this.notificationService,
        this.reputationService,
        this.eventBus,
      ),
    );
    this.register(
      new MilestoneApprovedHandler(
        this.projectRepository,
        this.milestoneRepository,
        this.contributionRepository,
        this.notificationService,
        this.reputationService,
        this.eventBus,
      ),
    );
    this.register(
      new MilestoneRejectedHandler(
        this.projectRepository,
        this.milestoneRepository,
        this.contributionRepository,
        this.notificationService,
        this.reputationService,
        this.eventBus,
      ),
    );
    this.register(new FundsReleasedHandler(this.projectRepository, this.milestoneRepository));
    this.register(new ProjectCompletedHandler(this.projectRepository));
    this.register(new ProjectFailedHandler(this.projectRepository));
    this.register(
      new DividendClaimedHandler(this.userRepository, this.reputationService, this.eventBus),
    );

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
      this.logger.debug(`No handler registered for event type: ${event.eventType}`);
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
      this.logger.error(`Error processing event ${event.eventType}: ${error.message}`, error.stack);
      throw error;
    }
  }

  isSupported(eventType: string): boolean {
    return this.handlers.has(eventType);
  }
}
