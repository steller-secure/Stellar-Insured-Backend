import { IsString, IsEmail, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole, SignupSource, UserStatus } from '../entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for user signup request
 */
export class SignupRequestDto {
  /**
   * Stellar wallet public key (primary identifier)
   * Format: ^G[A-Z2-7]{56}$ - standard Stellar public key
   */
  @ApiProperty({
    description: 'Stellar wallet public key',
    example: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
    pattern: '^G[A-Z2-7]{56}$',
  })
  @IsString()
  @Matches(/^G[A-Z2-7]{56}$/, {
    message:
      'Invalid Stellar public key format. Must start with G followed by 56 characters from A-Z and 2-7.',
  })
  @Transform(({ value }) => value?.trim())
  walletAddress: string;

  /**
   * Optional email address for notifications
   */
  @ApiPropertyOptional({
    description: 'Email address for notifications (optional)',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;

  /**
   * Optional display name
   */
  @ApiPropertyOptional({
    description: 'User display name (optional)',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  displayName?: string;

  /**
   * Referral code (if user was referred)
   */
  @ApiPropertyOptional({
    description: 'Referral code from existing user',
    example: 'REF123ABC',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;

  /**
   * Signup source tracking
   */
  @ApiPropertyOptional({
    description: 'Source of signup',
    enum: SignupSource,
    default: SignupSource.ORGANIC,
  })
  @IsOptional()
  @IsString()
  signupSource?: SignupSource = SignupSource.ORGANIC;

  /**
   * Terms and conditions acceptance
   */
  @ApiProperty({
    description: 'User accepts terms and conditions',
    example: true,
  })
  @IsString()
  acceptTerms: boolean;

  /**
   * Simple CAPTCHA token for anti-automation
   */
  @ApiPropertyOptional({
    description: 'CAPTCHA token for bot prevention',
    example: 'captcha_token_xyz',
  })
  @IsOptional()
  @IsString()
  captchaToken?: string;
}

/**
 * DTO for signup response
 */
export class SignupResponseDto {
  /**
   * Unique user ID
   */
  @ApiProperty({
    description: 'Unique user identifier (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  /**
   * Stellar wallet address
   */
  @ApiProperty({
    description: 'Stellar wallet public key',
    example: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
  })
  walletAddress: string;

  /**
   * Email address (if provided)
   */
  @ApiPropertyOptional({
    description: 'User email address',
    example: 'user@example.com',
  })
  email?: string;

  /**
   * Display name
   */
  @ApiPropertyOptional({
    description: 'User display name',
    example: 'John Doe',
  })
  displayName?: string;

  /**
   * User roles
   */
  @ApiProperty({
    description: 'User roles in system',
    enum: UserRole,
    isArray: true,
    example: [UserRole.USER],
  })
  roles: UserRole[];

  /**
   * Account status
   */
  @ApiProperty({
    description: 'Account status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  /**
   * Account creation timestamp
   */
  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2026-01-22T10:00:00.000Z',
  })
  createdAt: Date;

  /**
   * Success message
   */
  @ApiProperty({
    description: 'Success message',
    example: 'User account created successfully',
  })
  message: string;
}

/**
 * DTO for email verification request
 */
export class VerifyEmailRequestDto {
  /**
   * Verification token sent to email
   */
  @ApiProperty({
    description: 'Email verification token',
    example: 'verification_token_xyz',
  })
  @IsString()
  token: string;
}

/**
 * DTO for wallet verification request
 */
export class VerifyWalletRequestDto {
  /**
   * User ID
   */
  @ApiProperty({
    description: 'User ID to verify',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  userId: string;

  /**
   * Signed message proving wallet ownership
   */
  @ApiProperty({
    description: 'Message signed by wallet private key',
    example: 'signed_message_xyz',
  })
  @IsString()
  signedMessage: string;
}

/**
 * DTO for bulk user import
 */
export class BulkUserImportDto {
  /**
   * Array of wallet addresses to import
   */
  @ApiProperty({
    description: 'Array of Stellar wallet addresses to import',
    type: [String],
    example: [
      'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
      'GBUQWP3BOUZX34ULNQG23RQ6F4BFSRJSU6PINE7HDF4EVJAVIA72Xbulls',
    ],
  })
  @IsString({ each: true })
  walletAddresses: string[];

  /**
   * Source of bulk import
   */
  @ApiProperty({
    description: 'Source of the bulk import',
    example: 'BULK_IMPORT',
  })
  @IsString()
  source: string;

  /**
   * Import campaign identifier
   */
  @ApiPropertyOptional({
    description: 'Campaign identifier for tracking',
    example: 'campaign_001',
  })
  @IsOptional()
  @IsString()
  campaignId?: string;
}

/**
 * DTO for bulk import response
 */
export class BulkUserImportResponseDto {
  /**
   * Total users in import
   */
  @ApiProperty({
    description: 'Total users in the import',
    example: 100,
  })
  total: number;

  /**
   * Successfully created users
   */
  @ApiProperty({
    description: 'Number of successfully created users',
    example: 98,
  })
  successCount: number;

  /**
   * Failed imports
   */
  @ApiProperty({
    description: 'Number of failed imports',
    example: 2,
  })
  failureCount: number;

  /**
   * Failures details
   */
  @ApiProperty({
    description: 'Details of failed imports',
    example: [
      {
        walletAddress: 'INVALID_ADDRESS',
        reason: 'Invalid Stellar public key format',
      },
    ],
  })
  failures: Array<{ walletAddress: string; reason: string }>;
}
