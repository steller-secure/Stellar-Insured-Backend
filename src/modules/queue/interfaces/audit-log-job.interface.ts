export interface AuditLogJobData {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Date;
}
