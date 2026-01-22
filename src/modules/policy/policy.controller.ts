import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PolicyService } from './policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { PolicyTransitionDto } from './dto/policy-transition.dto';

@Controller('policies')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createPolicy(@Body() dto: CreatePolicyDto) {
    // TODO: Extract userId from request context
    const userId = 'user-123';
    return this.policyService.createPolicy(dto, userId);
  }

  @Get(':id')
  getPolicy(@Param('id') id: string) {
    return this.policyService.getPolicy(id);
  }

  @Get(':id/audit-trail')
  getAuditTrail(@Param('id') id: string) {
    return this.policyService.getAuditTrail(id);
  }

  @Get(':id/available-transitions')
  getAvailableTransitions(@Param('id') id: string) {
    return this.policyService.getAvailableTransitions(id);
  }

  @Post(':id/transition')
  @HttpCode(HttpStatus.OK)
  transitionPolicy(
    @Param('id') id: string,
    @Body() dto: PolicyTransitionDto,
  ) {
    // TODO: Extract userId and userRole from request context
    const userId = 'user-123';
    const userRole = 'admin';
    return this.policyService.transitionPolicy(
      id,
      dto.action,
      userId,
      userRole,
      dto.reason,
    );
  }
}
