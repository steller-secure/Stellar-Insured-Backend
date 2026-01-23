import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
@SkipThrottle() // Health checks should always be available
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-01-22T00:00:00.000Z',
        uptime: 1234.567,
      },
    },
  })
  checkHealth() {
    return this.healthService.checkHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Application is ready to serve requests',
  })
  checkReadiness() {
    return this.healthService.checkReadiness();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
  })
  checkLiveness() {
    return this.healthService.checkLiveness();
  }

  @Get('queues')
  @ApiOperation({ summary: 'Queue health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-01-22T00:00:00.000Z',
        queues: {
          'audit-logs': {
            active: 0,
            waiting: 5,
            delayed: 0,
            failed: 0,
            completed: 100,
          },
        },
      },
    },
  })
  async checkQueues() {
    return this.healthService.checkQueues();
  }
}
