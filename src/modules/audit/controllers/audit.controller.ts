import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { AuditQueryDto } from '../dtos/audit-query.dto';
import { AuditLogsResponseDto } from '../dtos/audit-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'Get audit logs',
    description: 'Retrieve audit logs with filtering, pagination, and sorting. Admin access required.',
  })
  @ApiQuery({
    name: 'actionType',
    required: false,
    description: 'Filter by action type',
  })
  @ApiQuery({
    name: 'actor',
    required: false,
    description: 'Filter by actor (user ID or wallet)',
  })
  @ApiQuery({
    name: 'entityReference',
    required: false,
    description: 'Filter by entity reference (policy ID, claim ID, etc.)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date filter (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date filter (ISO 8601)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 50, max: 100)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field (default: timestamp)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (ASC or DESC, default: DESC)',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
    type: AuditLogsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAuditLogs(
    @Query(new ValidationPipe({ transform: true })) query: AuditQueryDto,
  ): Promise<AuditLogsResponseDto> {
    // Convert date strings to Date objects
    const processedQuery = {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    return this.auditService.getAuditLogs(processedQuery);
  }
}