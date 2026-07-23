import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class PinMetadataDto {
  @ApiProperty({ description: 'Arbitrary metadata to pin', type: Object })
  @IsObject()
  metadata!: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Optional friendly name for the metadata',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
