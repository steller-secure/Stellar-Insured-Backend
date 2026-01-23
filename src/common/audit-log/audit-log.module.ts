import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { AuditLogService } from './audit-log.service';
import { ClaimAuditLogListener } from '../listeners/claim-audit-log.listener';

@Module({
  imports: [QueueModule],
  providers: [AuditLogService, ClaimAuditLogListener],
  exports: [AuditLogService],
})
export class AuditLogModule {}
