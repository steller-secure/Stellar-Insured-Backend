import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, Min, Max } from 'class-validator';

export class OptimizeImageDto {
  @ApiProperty({ description: 'Path to an existing image file' })
  @IsString()
  imagePath!: string;

  @ApiProperty({
    description: 'Target width in pixels',
    minimum: 1,
    maximum: 8192,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(8192)
  width!: number;

  @ApiProperty({
    description: 'Target height in pixels',
    minimum: 1,
    maximum: 8192,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(8192)
  height!: number;
}
