import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProposalDto {
  @ApiProperty({
    example: 'Increase treasury allocation for development',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    example: 'This proposal aims to increase the development fund by 20%...',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: '2024-01-15T00:00:00.000Z',
    description: 'ISO 8601 date string for voting start',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2024-01-22T23:59:59.999Z',
    description: 'ISO 8601 date string for voting end',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    example: false,
    description: 'If true, proposal will be immediately set to ACTIVE status',
  })
  @IsOptional()
  @IsBoolean()
  activateImmediately?: boolean;
}
