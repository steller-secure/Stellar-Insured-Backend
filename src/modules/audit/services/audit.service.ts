import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit.entity';
import { AuditActionType } from '../enums/audit-action-type.enum';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Logs an audit action to the database
   * @param actionType The type of action performed
   * @param actor The user ID or wallet address performing the action
   * @param entityReference Optional reference to the entity (policy ID, claim ID, etc.)
   * @param metadata Optional additional metadata
   */
  async logAction(
    actionType: AuditActionType,
    actor: string,
    entityReference?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      // Validate inputs
      if (!actionType || typeof actionType !== 'string') {
        throw new Error('Invalid actionType provided');
      }
      if (!actor || typeof actor !== 'string' || actor.trim().length === 0) {
        throw new Error('Invalid actor provided');
      }

      const auditLog = this.auditLogRepository.create({
        actionType,
        actor: actor.trim(),
        entityReference: entityReference?.trim() || undefined,
        metadata: metadata || undefined,
      });

      await this.auditLogRepository.save(auditLog);

      this.logger.debug(
        `Audit log created: ${actionType} by ${actor} on ${entityReference || 'N/A'}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create audit log: ${error.message}`,
        error.stack,
      );
      // Don't throw - audit logging should not break main operations
    }
  }

  /**
   * Retrieves audit logs with filtering, pagination, and sorting
   */
  async getAuditLogs(query: {
    actionType?: AuditActionType;
    actor?: string;
    entityReference?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const {
      actionType,
      actor,
      entityReference,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'timestamp',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit');

    // Apply filters
    if (actionType) {
      queryBuilder.andWhere('audit.actionType = :actionType', { actionType });
    }
    if (actor) {
      queryBuilder.andWhere('audit.actor = :actor', { actor });
    }
    if (entityReference) {
      queryBuilder.andWhere('audit.entityReference = :entityReference', {
        entityReference,
      });
    }
    if (startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate });
    }

    // Apply sorting
    const validSortFields = ['timestamp', 'actionType', 'actor', 'entityReference'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    queryBuilder.orderBy(`audit.${sortField}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Get results and count
    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}