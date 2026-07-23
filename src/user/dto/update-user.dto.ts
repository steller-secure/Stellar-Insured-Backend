import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  sanitizeString,
  sanitizeObject,
} from '../../common/utils/sanitization.util';

/**
 * Allowed profile data shape – restricts keys to known safe fields
 * and prevents arbitrary nested objects.
 */
export class ProfileDataDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) =>
    typeof value === 'string' ? sanitizeString(value) : value,
  )
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) =>
    typeof value === 'string' ? sanitizeString(value) : value,
  )
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) =>
    typeof value === 'string' ? sanitizeString(value) : value,
  )
  avatarUrl?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User email address' })
  @IsEmail()
  @IsOptional()
  @MaxLength(254)
  @Transform(({ value }) =>
    typeof value === 'string' ? sanitizeString(value) : value,
  )
  email?: string;

  @ApiPropertyOptional({
    description: 'User profile data (displayName, bio, avatarUrl)',
    type: Object,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileDataDto)
  profileData?: ProfileDataDto;

  @ApiPropertyOptional({ description: 'Encrypted push subscription payload' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return sanitizeString(value);
  })
  pushSubscription?: string;
}
