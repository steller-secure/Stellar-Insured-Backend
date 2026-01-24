import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('queue-management')
@Controller('admin/queues')
@Roles(UserRole.ADMIN)
export class QueueController {
  constructor(private queueService: QueueService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get queue statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Current queue statistics',
    schema: {
      example: {
        active: 2,
        waiting: 15,
        delayed: 5,
        failed: 1,
        completed: 250,
      },
    },
  })
  async getQueueStats() {
    return this.queueService.getQueueStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit-logs queue statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs queue statistics',
  })
  async getAuditLogsQueueStats() {
    return {
      queue: 'audit-logs',
      stats: await this.queueService.getQueueStats(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get queue health status (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Queue health status',
    schema: {
      example: {
        status: 'healthy',
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
  async getQueueHealth() {
    const stats = await this.queueService.getQueueStats();
    const isHealthy = stats.failed === 0 || stats.completed > stats.failed * 10;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      queues: {
        'audit-logs': stats,
      },
    };
  }
}
