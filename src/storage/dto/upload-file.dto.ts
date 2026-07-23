import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({
    description:
      'Optional prefix/folder path inside the bucket (e.g. "reports/2024")',
    example: 'uploads',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(/^[a-zA-Z0-9\-_/]*$/, {
    message:
      'Prefix must contain only alphanumeric chars, hyphens, underscores, or slashes',
  })
  prefix?: string;
}
