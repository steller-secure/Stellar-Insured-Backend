import { 
  Controller, 
  Get, 
  Param, 
  HttpException, 
  HttpStatus, 
  UseInterceptors 
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL, CacheKey } from '@nestjs/cache-manager'; // Ensure @nestjs/cache-manager is installed
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':walletAddress')
  @ApiOperation({ summary: 'Get aggregated dashboard data for a user' })
  @ApiParam({ name: 'walletAddress', description: 'The wallet address of the user', example: '0x123...' })
  @ApiResponse({ status: 200, description: 'Returns the dashboard summary', type: DashboardSummaryDto })
  // FIX: Add Caching (30 seconds TTL)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30000) 
  async getDashboardSummary(@Param('walletAddress') walletAddress: string): Promise<DashboardSummaryDto> {
    try {
      return await this.dashboardService.getSummary(walletAddress);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch dashboard data',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}