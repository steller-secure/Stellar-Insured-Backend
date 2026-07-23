import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base Contribution DTO with serialized BigInt fields
 */
export class ContributionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  transactionHash: string;

  @ApiProperty()
  investorId: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty({ description: 'Contribution amount as string (BigInt)' })
  amount: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/**
 * Create Contribution DTO
 */
export class CreateContributionDto {
  @ApiProperty()
  transactionHash: string;

  @ApiProperty()
  investorId: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty({
    description: 'Contribution amount as string (will be converted to BigInt)',
  })
  amount: string;
}

/**
 * Contribution List Response DTO
 */
export class ContributionListDto {
  @ApiProperty({ type: [ContributionDto] })
  data: ContributionDto[];

  @ApiProperty()
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
