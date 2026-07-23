import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  sanitizeString,
  isValidCuid,
} from '../../common/utils/sanitization.util';

export class UserParamsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const sanitized = sanitizeString(value);
    return sanitized;
  })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'id must be alphanumeric (CUID format)',
  })
  id: string;
}
