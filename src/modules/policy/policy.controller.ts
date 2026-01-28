import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiTooManyRequestsResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PolicyService } from './policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { PolicyTransitionDto } from './dto/policy-transition.dto';
import { Idempotent } from 'src/common/idempotency';

@ApiTags('Policies')
@Controller('policies')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new policy' })
  @ApiResponse({ status: 201, description: 'Policy created successfully' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique identifier for idempotent requests (required)',
    required: true,
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 policies per minute
  @Idempotent()
  createPolicy(@Body() dto: CreatePolicyDto) {
    // TODO: Extract userId from request context
    const userId = 'user-123';
    return this.policyService.createPolicy(dto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get policy by ID' })
  @ApiResponse({ status: 200, description: 'Policy retrieved successfully' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @Throttle({ public: { limit: 50, ttl: 60000 } }) // 50 reads per minute
  getPolicy(@Param('id') id: string) {
    return this.policyService.getPolicy(id);
  }

  @Get(':id/audit-trail')
  @ApiOperation({ summary: 'Get policy audit trail' })
  @ApiResponse({
    status: 200,
    description: 'Audit trail retrieved successfully',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @Throttle({ public: { limit: 50, ttl: 60000 } }) // 50 reads per minute
  getAuditTrail(@Param('id') id: string) {
    return this.policyService.getAuditTrail(id);
  }

  @Get(':id/available-transitions')
  @ApiOperation({ summary: 'Get available policy transitions' })
  @ApiResponse({ status: 200, description: 'Available transitions retrieved' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @Throttle({ public: { limit: 50, ttl: 60000 } }) // 50 reads per minute
  getAvailableTransitions(@Param('id') id: string) {
    return this.policyService.getAvailableTransitions(id);
  }

  @Post(':id/transition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transition policy to new status' })
  @ApiResponse({ status: 200, description: 'Policy transitioned successfully' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique identifier for idempotent requests (required)',
    required: true,
  })
  @Throttle({ admin: { limit: 100, ttl: 60000 } }) // Admin endpoint: 100 per minute
  @Idempotent()
  transitionPolicy(@Param('id') id: string, @Body() dto: PolicyTransitionDto) {
    // TODO: Extract userId and userRole from request context
    const userId = 'user-123';
    const userRoles = ['admin'];
    return this.policyService.transitionPolicy(
      id,
      dto.action,
      userId,
      userRoles,
      dto.reason,
    );
  }
}
