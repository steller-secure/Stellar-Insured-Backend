import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  async log(
    action: string,
    userId: string,
    ip: string,
    details?: any,
  ): Promise<void> {
    this.logger.log(`Audit: ${action} by ${userId} from ${ip}`, details);
  }
}
