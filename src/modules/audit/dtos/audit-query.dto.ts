import { IsOptional, IsEnum, IsString, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuditActionType } from '../enums/audit-action-type.enum';

export class AuditQueryDto {
  @IsOptional()
  @IsEnum(AuditActionType)
  actionType?: AuditActionType;

  @IsOptional()
  @IsString()
  actor?: string;

  @IsOptional()
  @IsString()
  entityReference?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sortBy?: string = 'timestamp';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}