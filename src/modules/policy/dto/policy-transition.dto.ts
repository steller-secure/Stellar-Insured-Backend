import { IsEnum, IsString, IsOptional } from 'class-validator';
import { PolicyTransitionAction } from '../enums/policy-transition-action.enum';

export class PolicyTransitionDto {
  @IsEnum(PolicyTransitionAction)
  action: PolicyTransitionAction;

  @IsString()
  @IsOptional()
  reason?: string;
}
