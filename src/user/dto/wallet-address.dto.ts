import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeString } from '../../common/utils/sanitization.util';

export class WalletAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return sanitizeString(value);
  })
  @Matches(/^[A-Za-z0-9_\-.@]+$/, {
    message:
      'Wallet address must only contain alphanumeric characters and _-.@',
  })
  address: string;
}
