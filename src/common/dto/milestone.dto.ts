import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// MilestoneStatus enum values from schema
export enum MilestoneStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  FUNDED = 'FUNDED',
}

/**
 * Base Milestone DTO with serialized BigInt fields
 */
export class MilestoneDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ description: 'Funding amount as string (BigInt)' })
  fundingAmount: string;

  @ApiProperty({ enum: MilestoneStatus })
  status: MilestoneStatus;

  @ApiPropertyOptional()
  completionDate?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/**
 * Create Milestone DTO
 */
export class CreateMilestoneDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({
    description: 'Funding amount as string (will be converted to BigInt)',
  })
  fundingAmount: string;
}

/**
 * Update Milestone DTO
 */
export class UpdateMilestoneDto {
  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Funding amount as string (will be converted to BigInt)',
  })
  fundingAmount?: string;

  @ApiPropertyOptional({ enum: MilestoneStatus })
  status?: MilestoneStatus;

  @ApiPropertyOptional()
  completionDate?: string;
}

/**
 * Milestone List Response DTO
 */
export class MilestoneListDto {
  @ApiProperty({ type: [MilestoneDto] })
  data: MilestoneDto[];

  @ApiProperty()
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
