import { Module } from '@nestjs/common';
import { PolicyStateMachineService } from './services/policy-state-machine.service';
import { PolicyAuditService } from './services/policy-audit.service';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';

@Module({
  providers: [PolicyStateMachineService, PolicyAuditService, PolicyService],
  controllers: [PolicyController],
  exports: [PolicyStateMachineService, PolicyAuditService],
})
export class PolicyModule {}
