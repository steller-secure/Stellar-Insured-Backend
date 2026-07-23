import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base InsurancePool DTO with serialized Decimal fields
 */
export class InsurancePoolDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Capital as string (Decimal)' })
  capital: string;

  @ApiProperty({ description: 'Locked capital as string (Decimal)' })
  lockedCapital: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/**
 * Create InsurancePool DTO
 */
export class CreateInsurancePoolDto {
  @ApiProperty()
  name: string;

  @ApiProperty({
    description: 'Capital as string (will be converted to Decimal)',
  })
  capital: string;
}

/**
 * Update InsurancePool DTO
 */
export class UpdateInsurancePoolDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Capital as string (will be converted to Decimal)',
  })
  capital?: string;
}

/**
 * InsurancePool List Response DTO
 */
export class InsurancePoolListDto {
  @ApiProperty({ type: [InsurancePoolDto] })
  data: InsurancePoolDto[];

  @ApiProperty()
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
