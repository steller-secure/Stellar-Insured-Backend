import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeString } from '../utils/sanitization.util';

export class ClaimIdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeString(value) : value))
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'claimId must contain only alphanumeric characters and hyphens',
  })
  claimId: string;
}
