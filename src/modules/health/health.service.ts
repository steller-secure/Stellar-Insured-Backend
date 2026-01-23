import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckResponse } from './health.interface';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class HealthService {
  constructor(
    private configService: ConfigService,
    private queueService: QueueService,
  ) {}

  checkHealth(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: this.configService.get<string>('APP_VERSION'),
      environment: this.configService.get<string>('NODE_ENV'),
    };
  }

  checkReadiness(): HealthCheckResponse {
    // In a real application, this would check database connections,
    // external services, etc.
    return this.checkHealth();
  }

  checkLiveness(): HealthCheckResponse {
    // Basic liveness check - if the application is responding, it's alive
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async checkQueues(): Promise<any> {
    try {
      const stats = await this.queueService.getQueueStats();
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        queues: {
          'audit-logs': stats,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
