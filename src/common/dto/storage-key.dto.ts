import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeString } from '../utils/sanitization.util';

export class StorageKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeString(value) : value))
  @Matches(/^[A-Za-z0-9_\-./]+$/, {
    message: 'Storage key contains invalid characters',
  })
  key: string;
}
