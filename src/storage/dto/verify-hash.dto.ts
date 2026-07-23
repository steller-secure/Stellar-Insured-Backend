import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class VerifyHashDto {
  @ApiProperty({
    description: 'Alphanumeric hash value to verify',
    minLength: 1,
    maxLength: 128,
    example: 'Qm4f5G3f3u',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'Hash must be alphanumeric',
  })
  hash!: string;
}
