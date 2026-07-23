import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ClaimStatus enum values from schema
export enum ClaimStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

/**
 * Base Claim DTO with serialized Decimal fields
 */
export class ClaimDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  policyId: string;

  @ApiProperty({ description: 'Claim amount as string (Decimal)' })
  claimAmount: string;

  @ApiProperty({ enum: ClaimStatus })
  status: ClaimStatus;

  @ApiPropertyOptional({ description: 'Payout amount as string (Decimal)' })
  payoutAmount?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/**
 * Create Claim DTO
 */
export class CreateClaimDto {
  @ApiProperty()
  policyId: string;

  @ApiProperty({
    description: 'Claim amount as string (will be converted to Decimal)',
  })
  claimAmount: string;

  @ApiPropertyOptional()
  description?: string;
}

/**
 * Update Claim DTO
 */
export class UpdateClaimDto {
  @ApiPropertyOptional({ enum: ClaimStatus })
  status?: ClaimStatus;

  @ApiPropertyOptional({
    description: 'Payout amount as string (will be converted to Decimal)',
  })
  payoutAmount?: string;

  @ApiPropertyOptional()
  description?: string;
}

/**
 * Claim List Response DTO
 */
export class ClaimListDto {
  @ApiProperty({ type: [ClaimDto] })
  data: ClaimDto[];

  @ApiProperty()
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
