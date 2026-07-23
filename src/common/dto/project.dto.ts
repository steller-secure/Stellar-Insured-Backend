import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ProjectStatus enum values from schema
export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
}

/**
 * Base Project DTO with serialized BigInt fields
 */
export class ProjectDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  contractId: string;

  @ApiProperty()
  creatorId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ description: 'Funding goal as string (BigInt)' })
  goal: string;

  @ApiProperty({ description: 'Current funds as string (BigInt)' })
  currentFunds: string;

  @ApiProperty()
  deadline: string;

  @ApiProperty({ enum: ProjectStatus })
  status: ProjectStatus;

  @ApiPropertyOptional()
  ipfsHash?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/**
 * Create Project DTO
 */
export class CreateProjectDto {
  @ApiProperty()
  contractId: string;

  @ApiProperty()
  creatorId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  category: string;

  @ApiProperty({
    description: 'Funding goal as string (will be converted to BigInt)',
  })
  goal: string;

  @ApiProperty()
  deadline: string;

  @ApiPropertyOptional()
  ipfsHash?: string;
}

/**
 * Update Project DTO
 */
export class UpdateProjectDto {
  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'Funding goal as string (will be converted to BigInt)',
  })
  goal?: string;

  @ApiPropertyOptional()
  deadline?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  status?: ProjectStatus;

  @ApiPropertyOptional()
  ipfsHash?: string;
}

/**
 * Project List Response DTO
 */
export class ProjectListDto {
  @ApiProperty({ type: [ProjectDto] })
  data: ProjectDto[];

  @ApiProperty()
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
