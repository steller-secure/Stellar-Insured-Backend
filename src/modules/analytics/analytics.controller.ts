import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, AnalyticsOverviewDto } from './dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get analytics overview',
    description:
      'Returns aggregated analytics metrics for DAO, policies, claims, and fraud detection',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for filtering (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for filtering (ISO 8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics overview retrieved successfully',
    type: AnalyticsOverviewDto,
  })
  async getOverview(
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsOverviewDto> {
    return this.analyticsService.getOverview(query);
  }
}
