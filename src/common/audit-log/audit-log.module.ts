import { Module } from '@nestjs/common';
// FIX: Go up 2 levels to 'src', then into 'modules'
import { QueueModule } from '../../modules/queue/queue.module'; 
// FIX: Go up 1 level to 'common', then into 'services'
import { AuditLogService } from '../services/audit-log.service';

@Module({
  imports: [QueueModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}