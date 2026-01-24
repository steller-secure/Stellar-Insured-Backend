import { Injectable } from '@nestjs/common';
// FIX: Use ../../ (Two dots) to get to src
import { QueueService } from '../../modules/queue/queue.service';
import { AuditLogJobData } from '../../modules/queue/interfaces/audit-log-job.interface';

@Injectable()
export class AuditLogService {
  constructor(private readonly queueService: QueueService) {}

  async logEvent(data: AuditLogJobData): Promise<void> {
    await this.queueService.addAuditLogJob(data);
  }
}