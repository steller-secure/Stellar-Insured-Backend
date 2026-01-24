import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyStateMachineService } from './services/policy-state-machine.service';
import { PolicyAuditService } from './services/policy-audit.service';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';
import { Policy } from './entities/policy.entity';
import { PolicyStatusHistory } from './entities/policy-status-history.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Policy, PolicyStatusHistory]), AuditModule],
  providers: [PolicyStateMachineService, PolicyAuditService, PolicyService],
  controllers: [PolicyController],
  exports: [PolicyStateMachineService, PolicyAuditService, PolicyService],
})
export class PolicyModule {}
