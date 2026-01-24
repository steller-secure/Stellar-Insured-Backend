import { Expose } from 'class-transformer';
import { AuditActionType } from '../enums/audit-action-type.enum';

export class AuditLogResponseDto {
  @Expose()
  id: string;

  @Expose()
  actionType: AuditActionType;

  @Expose()
  actor: string;

  @Expose()
  timestamp: Date;

  @Expose()
  entityReference?: string;

  @Expose()
  metadata?: Record<string, any>;
}

export class AuditLogsResponseDto {
  @Expose()
  data: AuditLogResponseDto[];

  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  totalPages: number;
}