import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// PolicyStatus enum values from schema
export enum PolicyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING',
}

// RiskType enum values from schema
export enum RiskType {
  PROJECT_FAILURE = 'PROJECT_FAILURE',
  SMART_CONTRACT_EXPLOIT = 'SMART_CONTRACT_EXPLOIT',
  MARKET_VOLATILITY = 'MARKET_VOLATILITY',
}

/**
 * Base InsurancePolicy DTO with serialized Decimal fields
 */
export class InsurancePolicyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  poolId: string;

  @ApiPropertyOptional()
  contractId?: string;

  @ApiProperty({ enum: RiskType })
  riskType: RiskType;

  @ApiProperty({ enum: PolicyStatus })
  status: PolicyStatus;

  @ApiProperty({ description: 'Premium as string (Decimal)' })
  premium: string;

  @ApiProperty({ description: 'Coverage amount as string (Decimal)' })
  coverageAmount: string;

  @ApiPropertyOptional()
  startDate?: string;

  @ApiPropertyOptional()
  endDate?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/**
 * Create InsurancePolicy DTO
 */
export class CreateInsurancePolicyDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  poolId: string;

  @ApiPropertyOptional()
  contractId?: string;

  @ApiProperty({ enum: RiskType })
  riskType: RiskType;

  @ApiProperty({
    description: 'Premium as string (will be converted to Decimal)',
  })
  premium: string;

  @ApiProperty({
    description: 'Coverage amount as string (will be converted to Decimal)',
  })
  coverageAmount: string;

  @ApiPropertyOptional()
  startDate?: string;

  @ApiPropertyOptional()
  endDate?: string;
}

/**
 * Update InsurancePolicy DTO
 */
export class UpdateInsurancePolicyDto {
  @ApiPropertyOptional({ enum: PolicyStatus })
  status?: PolicyStatus;

  @ApiPropertyOptional({
    description: 'Premium as string (will be converted to Decimal)',
  })
  premium?: string;

  @ApiPropertyOptional({
    description: 'Coverage amount as string (will be converted to Decimal)',
  })
  coverageAmount?: string;

  @ApiPropertyOptional()
  startDate?: string;

  @ApiPropertyOptional()
  endDate?: string;
}
