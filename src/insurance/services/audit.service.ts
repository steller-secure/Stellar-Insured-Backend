import { Injectable, Inject, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditLogRepository } from '../../common/repositories/audit-log.repository';
import { TransactionClient } from '../../common/repositories/repository.interface';
import { redactValue } from '../../common/utils/log-redaction.util';
import { getCorrelationId } from '../../common/tracing/tracing-context';

type AuditState = Prisma.InputJsonValue | null;

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
  };
}

@Injectable({ scope: Scope.REQUEST })
export class AuditService {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    @Inject(REQUEST) private request: AuthenticatedRequest,
  ) {}

  private getUserId(): string | undefined {
    return this.request.user?.id;
  }

  private getIpAddress(): string | undefined {
    return this.request.ip || this.request.connection.remoteAddress;
  }

  private getUserAgent(): string | undefined {
    return this.request.get('User-Agent');
  }

  async log(
    action: AuditAction,
    entityType: string,
    entityId: string,
    beforeState?: unknown,
    afterState?: unknown,
    transactionHash?: string,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.auditLogRepository.createLog(
      {
        userId: this.getUserId(),
        action,
        entityType,
        entityId,
        beforeState: this.toAuditState(beforeState) ?? undefined,
        afterState: this.toAuditState(afterState) ?? undefined,
        ipAddress: this.getIpAddress(),
        userAgent: this.getUserAgent(),
        transactionHash,
        reason,
        correlationId: getCorrelationId(),
        timestamp: new Date(),
      } as any,
      tx,
    );
  }

  async logCreate(
    entityType: string,
    entityId: string,
    afterState: unknown,
    transactionHash?: string,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.log(AuditAction.CREATE, entityType, entityId, null, afterState, transactionHash, reason, tx);
  }

  async logUpdate(
    entityType: string,
    entityId: string,
    beforeState: unknown,
    afterState: unknown,
    transactionHash?: string,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.log(AuditAction.UPDATE, entityType, entityId, beforeState, afterState, transactionHash, reason, tx);
  }

  async logDelete(
    entityType: string,
    entityId: string,
    beforeState: unknown,
    transactionHash?: string,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.log(AuditAction.DELETE, entityType, entityId, beforeState, null, transactionHash, reason, tx);
  }

  async logApprove(
    entityType: string,
    entityId: string,
    beforeState?: unknown,
    afterState?: unknown,
    transactionHash?: string,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.log(AuditAction.APPROVE, entityType, entityId, beforeState, afterState, transactionHash, reason, tx);
  }

  async logReject(
    entityType: string,
    entityId: string,
    beforeState?: unknown,
    afterState?: unknown,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.log(AuditAction.REJECT, entityType, entityId, beforeState, afterState, undefined, reason, tx);
  }

  async logPayout(
    entityType: string,
    entityId: string,
    beforeState?: unknown,
    afterState?: unknown,
    transactionHash?: string,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.log(AuditAction.PAYOUT, entityType, entityId, beforeState, afterState, transactionHash, reason, tx);
  }

  async logPurchase(
    entityType: string,
    entityId: string,
    afterState: unknown,
    transactionHash?: string,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.log(AuditAction.PURCHASE, entityType, entityId, null, afterState, transactionHash, reason, tx);
  }

  async logUnlockCapital(
    entityType: string,
    entityId: string,
    beforeState: unknown,
    afterState: unknown,
    transactionHash?: string,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.log(AuditAction.UNLOCK_CAPITAL, entityType, entityId, beforeState, afterState, transactionHash, reason, tx);
  }

  async logAddCapital(
    entityType: string,
    entityId: string,
    beforeState: unknown,
    afterState: unknown,
    transactionHash?: string,
    reason?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await this.log(AuditAction.ADD_CAPITAL, entityType, entityId, beforeState, afterState, transactionHash, reason, tx);
  }

  /**
   * Compute a diff between two states, returning only changed fields.
   * Sensitive fields (email, pushSubscription) are redacted.
   */
  snapshotDiff(
    before: unknown,
    after: unknown,
  ): { beforeState: AuditState; afterState: AuditState } {
    const b = before && typeof before === 'object' ? { ...(before as Record<string, unknown>) } : {};
    const a = after && typeof after === 'object' ? { ...(after as Record<string, unknown>) } : {};
    return {
      beforeState: this.toAuditState(this.redactSensitive(b)) ?? null,
      afterState: this.toAuditState(this.redactSensitive(a)) ?? null,
    };
  }

  private redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted = redactValue(obj);
    if (typeof redacted === 'object' && redacted !== null && !Array.isArray(redacted)) {
      return redacted as Record<string, unknown>;
    }
    return obj;
  }

  private toAuditState(value: unknown): AuditState | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(redactValue(value))) as Prisma.InputJsonValue;
  }
}
