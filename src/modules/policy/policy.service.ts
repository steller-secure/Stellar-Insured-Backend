import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import { Policy } from './entities/policy.entity';
import { PolicyStateMachineService } from './services/policy-state-machine.service';
import { PolicyAuditService } from './services/policy-audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PolicyStatus } from './enums/policy-status.enum';
import { PolicyTransitionAction } from './enums/policy-transition-action.enum';
import { CreatePolicyDto } from './dto/create-policy.dto';
import {
  EventNames,
  PolicyIssuedEvent,
  PolicyRenewedEvent,
  PolicyExpiredEvent,
  PolicyCancelledEvent,
} from '../../events';
import { AuditService } from '../audit/services/audit.service';
import { AuditActionType } from '../audit/enums/audit-action-type.enum';
import { PaginationDto } from 'src/common/pagination/dto/pagination.dto';
import { PaginatedResult } from 'src/common/pagination/interfaces/paginated-result.interface';
import { paginate } from 'src/common/pagination/pagination.util';

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
    private stateMachine: PolicyStateMachineService,
    private auditService: PolicyAuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogService: AuditService,
  ) {}

  /**
   * Creates a new policy in DRAFT status.
   */
  async createPolicy(dto: CreatePolicyDto, userId: string): Promise<Policy> {
    // Note: In a real app, we'd fetch the User entity first
    const policy = this.policyRepository.create({
      policyNumber: `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      status: PolicyStatus.DRAFT,
      coverageType: dto.coverageType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      premium: dto.premium,
    });

    const savedPolicy = await this.policyRepository.save(policy);
    this.logger.log(`Policy created: ${savedPolicy.id} in ${savedPolicy.status} status`);

    // Audit log the policy creation
    await this.auditLogService.logAction(
      AuditActionType.POLICY_CREATED,
      userId,
      savedPolicy.id,
      {
        policyNumber: savedPolicy.policyNumber,
        coverageType: savedPolicy.coverageType,
        premium: savedPolicy.premium,
      },
    );

    return savedPolicy;
  }

  /**
   * Transitions a policy to a new status with validation.
   * Emits domain events for notification handling.
   */
  async transitionPolicy(
    policyId: string,
    action: PolicyTransitionAction,
    userId: string,
    userRoles: string[],
    reason?: string,
  ): Promise<Policy> {
    const policy = await this.getPolicy(policyId);

    // Execute transition with full validation
    const { auditEntry, stateChangeEvent } =
      this.stateMachine.executeTransition(
        policy.status,
        action,
        userId,
        userRoles,
        policyId,
        reason,
      );

    // Update policy status
    policy.status = auditEntry.toStatus;
    await this.policyRepository.save(policy);

    // Record audit trail
    this.auditService.recordAuditEntry(auditEntry);
    this.auditService.publishStateChangeEvent(stateChangeEvent);

    // Emit notification events based on the action
    this.emitPolicyEvent(action, policyId, userId, reason);

    this.logger.log(
      `Policy ${policyId} transitioned from ${auditEntry.fromStatus} to ${auditEntry.toStatus}`,
    );

    // Invalidate analytics cache
    await this.cacheManager.del('analytics_dashboard');

    return policy;
  }

  /**
   * Get all policies with pagination
   */
  async getAllPolicies(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Policy>> {
    this.logger.debug('Retrieving all policies with pagination');
    const queryBuilder = this.policyRepository.createQueryBuilder('policy');
    queryBuilder.orderBy('policy.createdAt', 'DESC');

    return paginate(queryBuilder, paginationDto);
  }

  // FIXED: Added missing methods required by PolicyController
  async getPolicy(id: string) {
    const policy = await this.policyRepository.findOne({ where: { id } as any });
    if (!policy) throw new NotFoundException(`Policy with ID ${id} not found`);
    return policy;
  }

  async getAvailableTransitions(id: string) {
    const policy = await this.getPolicy(id);
    return this.stateMachine.getAvailableActions(policy.status);
  }

  async getAuditTrail(id: string) {
    // Placeholder for audit trail logic
    return [];
  }

  private emitPolicyEvent(action: PolicyTransitionAction, policyId: string, userId: string, reason?: string) {
    let event: any;

    switch (action) {
      case PolicyTransitionAction.ISSUE:
        event = new PolicyIssuedEvent(policyId, userId);
        break;
      case PolicyTransitionAction.RENEW:
        event = new PolicyRenewedEvent(policyId, userId);
        break;
      case PolicyTransitionAction.EXPIRE:
        event = new PolicyExpiredEvent(policyId, 'system');
        break;
      case PolicyTransitionAction.CANCEL:
        event = new PolicyCancelledEvent(policyId, userId, reason);
        break;
    }

    if (event) {
      this.eventEmitter.emit(event.constructor.name, event);
    }
  }
  // ... existing code ...
  // PASTE HERE (Inside the class)
  async getUserStats(walletAddress: string) {
    const policies = await this.policyRepository.find({ 
      where: { 
        // We query the relationship. TypeORM matches this to the User's ID.
        user: { id: walletAddress } as any, 
        status: PolicyStatus.ACTIVE 
      },
      // We must load the relation to access user details if needed, 
      // but for ID filtering, the 'where' above is usually enough.
    });

    // Since 'coverageAmount' doesn't exist, we sum 'premium' as a fallback
    // If you add a coverageAmount column later, change 'premium' to 'coverageAmount' here.
    const totalValue = policies.reduce((sum, p) => sum + (Number(p.premium) || 0), 0);

    return { activeCount: policies.length, totalValue };
  }
} // <--- The file must end with this closing brace