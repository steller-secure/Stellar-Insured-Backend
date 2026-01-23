import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { WalletService } from '../services/wallet.service';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import {
  SignupRequestDto,
  SignupResponseDto,
  VerifyEmailRequestDto,
  BulkUserImportDto,
  BulkUserImportResponseDto,
} from '../dtos/auth.dto';

/**
 * Authentication controller - handles user registration and account management
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private walletService: WalletService,
  ) {}

  /**
   * User signup endpoint - creates new account with Stellar wallet
   *
   * @param signupDto - User signup data
   * @returns Created user account details
   *
   * HTTP POST /auth/signup
   *
   * Business Flow:
   * 1. Validate wallet address format (Stellar public key)
   * 2. Validate email format (if provided)
   * 3. Check wallet uniqueness
   * 4. Check email uniqueness (if provided)
   * 5. Create user with default USER role
   * 6. Generate unique referral code
   * 7. Initialize user preferences, portfolio, and onboarding checklist
   * 8. Send welcome email (if email provided)
   * 9. Return success response with user details
   */
  @Public()
  @Post('signup')
  @UseGuards(RateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'User account created successfully',
    type: SignupResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet address, email format, or request validation error',
  })
  @ApiConflictResponse({
    description: 'Wallet address or email already registered',
  })
  @ApiOperation({
    summary: 'Register new user with Stellar wallet',
    description: `
    Creates a new user account using a Stellar wallet address as the primary identifier.
    
    Requirements:
    - Valid Stellar public key format (G + 56 characters from A-Z, 2-7)
    - Optional email for notifications (if provided, must be valid format)
    - Email must be unique across the system
    - Wallet address must be unique across the system
    - User must accept terms and conditions
    
    Response includes:
    - Unique user ID (UUID)
    - Wallet address
    - Email (if provided)
    - Default USER role
    - Account creation timestamp
    
    The user can immediately proceed to login after signup.
    `,
  })
  async signup(@Body() signupDto: SignupRequestDto): Promise<SignupResponseDto> {
    this.logger.log(
      `Signup request received for wallet: ${this.walletService.maskWalletAddress(signupDto.walletAddress)}`,
    );

    const result = await this.authService.signup(signupDto);

    this.logger.log(
      `User successfully created: ${result.id}`,
    );

    return result;
  }

  /**
   * Verify email endpoint - confirms user's email address
   *
   * @param userId - The user ID
   * @param verifyDto - Email verification data
   * @returns Success message
   *
   * HTTP POST /auth/verify-email/:userId
   */
  @Post('verify-email/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify user email address',
    description:
      'Confirms the user email with provided verification token sent to their email',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      example: { message: 'Email verified successfully', userId: 'user-id' },
    },
  })
  async verifyEmail(
    @Param('userId') userId: string,
    @Body() verifyDto: VerifyEmailRequestDto,
  ): Promise<{ message: string; userId: string }> {
    await this.authService.verifyEmail(userId, verifyDto.token);
    return {
      message: 'Email verified successfully',
      userId,
    };
  }

  /**
   * Resend verification email endpoint
   *
   * @param userId - The user ID
   * @returns Success message
   *
   * HTTP POST /auth/resend-verification-email/:userId
   */
  @Post('resend-verification-email/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Sends a new verification email to the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification email resent successfully',
    schema: {
      example: {
        message: 'Verification email sent successfully',
        userId: 'user-id',
      },
    },
  })
  async resendVerificationEmail(
    @Param('userId') userId: string,
  ): Promise<{ message: string; userId: string }> {
    await this.authService.resendVerificationEmail(userId);
    return {
      message: 'Verification email sent successfully',
      userId,
    };
  }

  /**
   * Get user info endpoint
   *
   * @param userId - The user ID
   * @returns User details
   *
   * HTTP GET /auth/users/:userId
   */
  @Get('users/:userId')
  @ApiOperation({
    summary: 'Get user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async getUserInfo(
    @Param('userId') userId: string,
  ): Promise<any> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      return { error: 'User not found', statusCode: 404 };
    }

    return {
      id: user.id,
      walletAddress: this.walletService.maskWalletAddress(user.walletAddress),
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      isWalletVerified: user.isWalletVerified,
      createdAt: user.createdAt,
    };
  }

  /**
   * Update user profile endpoint
   *
   * @param userId - The user ID
   * @param updateData - User data to update
   * @returns Updated user profile
   *
   * HTTP PATCH /auth/users/:userId
   */
  @Patch('users/:userId')
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Updates user profile information (displayName, email, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  async updateUserProfile(
    @Param('userId') userId: string,
    @Body() updateData: any,
  ): Promise<any> {
    const updated = await this.authService.updateUserProfile(userId, updateData);

    return {
      id: updated.id,
      walletAddress: this.walletService.maskWalletAddress(updated.walletAddress),
      displayName: updated.displayName,
      email: updated.email,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Bulk import users endpoint - for enterprise customers
   *
   * @param bulkImportDto - Array of wallet addresses
   * @returns Import results with success/failure counts
   *
   * HTTP POST /auth/bulk-import
   *
   * Business Flow:
   * 1. Validate all wallet addresses
   * 2. Check for existing wallets
   * 3. Create new users for valid wallets
   * 4. Track import source and campaign
   * 5. Return summary with success and failure counts
   */
  @Roles(UserRole.ADMIN)
  @Post('bulk-import')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Bulk user import completed',
    type: BulkUserImportResponseDto,
  })
  @ApiOperation({
    summary: 'Bulk import users (enterprise feature)',
    description: `
    Allows bulk import of user wallet addresses for enterprise customers.
    
    Features:
    - Validates all wallet addresses before import
    - Skips already registered wallets
    - Generates unique referral codes for each user
    - Tracks import source and campaign
    - Returns detailed success/failure report
    
    Maximum recommended: 1000 users per request
    `,
  })
  async bulkImportUsers(
    @Body() bulkImportDto: BulkUserImportDto,
  ): Promise<BulkUserImportResponseDto> {
    this.logger.log(
      `Bulk import request received for ${bulkImportDto.walletAddresses.length} users`,
    );

    const result = await this.authService.bulkImportUsers(bulkImportDto);

    this.logger.log(
      `Bulk import completed: ${result.successCount} success, ${result.failureCount} failures`,
    );

    return result;
  }

  /**
   * Check wallet availability endpoint - useful for frontend validation
   *
   * @param walletAddress - The wallet address to check
   * @returns Availability status
   *
   * HTTP GET /auth/check-wallet/:walletAddress
   */
  @Public()
  @Get('check-wallet/:walletAddress')
  @ApiOperation({
    summary: 'Check if wallet address is available for registration',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet availability status',
    schema: {
      example: {
        walletAddress: 'GBBD47UZQ5AKROVBVVVX4N2QG7XJXVG7R34OQCVM4PDXGJMXZ2BPSYQA',
        available: true,
        message: 'Wallet address is available for registration',
      },
    },
  })
  async checkWalletAvailability(
    @Param('walletAddress') walletAddress: string,
  ): Promise<{ walletAddress: string; available: boolean; message: string }> {
    try {
      this.walletService.validateWalletAddress(walletAddress);

      const exists = await this.authService.walletExists(walletAddress);

      return {
        walletAddress: this.walletService.maskWalletAddress(walletAddress),
        available: !exists,
        message: exists
          ? 'Wallet address is already registered'
          : 'Wallet address is available for registration',
      };
    } catch (error) {
      return {
        walletAddress: walletAddress.substring(0, 8) + '...',
        available: false,
        message: error instanceof Error ? error.message : 'Invalid wallet address',
      };
    }
  }

  /**
   * Check email availability endpoint
   *
   * @param email - The email to check
   * @returns Availability status
   *
   * HTTP GET /auth/check-email/:email
   */
  @Public()
  @Get('check-email/:email')
  @ApiOperation({
    summary: 'Check if email address is available for registration',
  })
  @ApiResponse({
    status: 200,
    description: 'Email availability status',
    schema: {
      example: {
        email: 'user@example.com',
        available: true,
        message: 'Email address is available for registration',
      },
    },
  })
  async checkEmailAvailability(
    @Param('email') email: string,
  ): Promise<{ email: string; available: boolean; message: string }> {
    try {
      this.walletService.validateEmail(email);

      const exists = await this.authService.emailExists(email);

      return {
        email,
        available: !exists,
        message: exists
          ? 'Email address is already registered'
          : 'Email address is available for registration',
      };
    } catch (error) {
      return {
        email,
        available: false,
        message: error instanceof Error ? error.message : 'Invalid email format',
      };
    }
  }
}
