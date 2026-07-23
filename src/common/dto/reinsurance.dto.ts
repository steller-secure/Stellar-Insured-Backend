import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base ReinsuranceContract DTO with serialized Decimal fields
 */
export class ReinsuranceContractDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  poolId: string;

  @ApiProperty({ description: 'Coverage limit as string (Decimal)' })
  coverageLimit: string;

  @ApiProperty({ description: 'Premium rate as string (Decimal)' })
  premiumRate: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/**
 * Create ReinsuranceContract DTO
 */
export class CreateReinsuranceContractDto {
  @ApiProperty()
  poolId: string;

  @ApiProperty({
    description: 'Coverage limit as string (will be converted to Decimal)',
  })
  coverageLimit: string;

  @ApiProperty({
    description: 'Premium rate as string (will be converted to Decimal)',
  })
  premiumRate: string;
}

/**
 * Update ReinsuranceContract DTO
 */
export class UpdateReinsuranceContractDto {
  @ApiPropertyOptional({
    description: 'Coverage limit as string (will be converted to Decimal)',
  })
  coverageLimit?: string;

  @ApiPropertyOptional({
    description: 'Premium rate as string (will be converted to Decimal)',
  })
  premiumRate?: string;
}

/**
 * ReinsuranceContract List Response DTO
 */
export class ReinsuranceContractListDto {
  @ApiProperty({ type: [ReinsuranceContractDto] })
  data: ReinsuranceContractDto[];

  @ApiProperty()
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
