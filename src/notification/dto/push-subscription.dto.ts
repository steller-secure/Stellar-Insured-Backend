import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsObject,
  IsOptional,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'Base64-encoded P-256 DH public key' })
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty({ description: 'Base64-encoded auth secret' })
  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class PushSubscriptionDto {
  @ApiProperty({ description: 'Push service endpoint URL' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({
    description: 'Encryption keys for the push subscription',
    type: PushSubscriptionKeysDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;

  @ApiPropertyOptional({
    description: 'Optional expiration timestamp for the subscription',
  })
  @IsOptional()
  @IsString()
  expirationTime?: string;
}
