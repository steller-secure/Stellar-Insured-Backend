import {
  IsUUID,
  IsEnum,
  IsDate,
  IsDecimal,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Max,
  Min,
  // Type removed from here
} from 'class-validator';
import { Type } from 'class-transformer'; // <--- Added correct import
import { ClaimType } from '../entities/claim.entity';

export class CreateClaimDto {
  @IsUUID()
  policyId: string;

  @IsEnum(ClaimType)
  claimType: ClaimType;

  @Type(() => Date)
  @IsDate()
  incidentDate: Date;

  @IsDecimal({ decimal_digits: '1,2' })
  @Min(0.01)
  @Max(999999.99)
  claimAmount: number;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @IsOptional()
  metadata?: Record<string, any>;
}