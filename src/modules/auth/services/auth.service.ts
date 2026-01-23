import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import {
  User,
  UserRole,
  UserStatus,
  SignupSource,
} from '../../users/entities/user.entity';
import { UserPreference } from '../../users/entities/user-preference.entity';
import { UserPortfolio } from '../../users/entities/user-portfolio.entity';
import { UserOnboardingChecklist } from '../../users/entities/user-onboarding-checklist.entity';
import {
  SignupRequestDto,
  SignupResponseDto,
  BulkUserImportDto,
  BulkUserImportResponseDto,
} from '../dtos/auth.dto';

/**
 * Mock in-memory database for users (in production, use actual database)
 */
const usersDatabase: Map<string, User> = new Map();
const emailIndex: Map<string, string> = new Map(); // Maps email to userId
const walletIndex: Map<string, string> = new Map(); // Maps wallet to userId
const referralCodeIndex: Map<string, string> = new Map(); // Maps referral code to userId

/**
 * Authentication service handling user registration and account management
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private walletService: WalletService) {}

  /**
   * Registers a new user with wallet-based signup
   *
   * @param signupDto - User signup request data
   * @returns User account information
   * @throws BadRequestException if validation fails
   * @throws ConflictException if wallet or email already exists
   */
  async signup(signupDto: SignupRequestDto): Promise<SignupResponseDto> {
    this.logger.log(`Processing signup for wallet: ${signupDto.walletAddress}`);

    // Validate wallet address format
    this.walletService.validateWalletAddress(signupDto.walletAddress);

    // Validate email if provided
    if (signupDto.email) {
      this.walletService.validateEmail(signupDto.email);
    }

    // Normalize inputs
    const normalizedWallet =
      this.walletService.normalizeWalletAddress(signupDto.walletAddress);
    const normalizedEmail = signupDto.email
      ? this.walletService.normalizeEmail(signupDto.email)
      : undefined;

    // Check if wallet already exists
    if (walletIndex.has(normalizedWallet)) {
      this.logger.warn(`Signup attempt with existing wallet: ${normalizedWallet}`);
      throw new ConflictException(
        'This wallet address is already registered. Please use login instead.',
      );
    }

    // Check if email already exists (if provided)
    if (normalizedEmail && emailIndex.has(normalizedEmail)) {
      this.logger.warn(`Signup attempt with existing email: ${normalizedEmail}`);
      throw new ConflictException(
        'This email address is already registered with another account.',
      );
    }

    // Create new user
    const newUser = new User();
    newUser.walletAddress = normalizedWallet;
    newUser.email = normalizedEmail;
    newUser.displayName = signupDto.displayName || normalizedWallet.substring(0, 8);
    newUser.roles = [UserRole.USER];
    newUser.status = UserStatus.ACTIVE;
    newUser.isWalletVerified = true; // Mark as verified during signup
    newUser.signupSource = signupDto.signupSource || SignupSource.ORGANIC;

    // Handle referral if referral code provided
    if (signupDto.referralCode) {
      const referrerId = referralCodeIndex.get(signupDto.referralCode);
      if (referrerId) {
        newUser.referrerId = referrerId;
        this.logger.log(
          `User ${newUser.id} referred by ${referrerId}`,
        );
        // TODO: Implement referral rewards system
      } else {
        this.logger.warn(
          `Invalid referral code provided: ${signupDto.referralCode}`,
        );
      }
    }

    // Generate unique referral code for this user
    newUser.referralCode = this.walletService.generateReferralCode();

    // Store user in database
    usersDatabase.set(newUser.id, newUser);
    walletIndex.set(normalizedWallet, newUser.id);
    if (normalizedEmail) {
      emailIndex.set(normalizedEmail, newUser.id);
    }
    referralCodeIndex.set(newUser.referralCode, newUser.id);

    // Create user preferences
    const userPreference = new UserPreference();
    userPreference.user = newUser;
    // TODO: Store in database

    // Create user portfolio
    const portfolio = new UserPortfolio();
    portfolio.user = newUser;
    // TODO: Store in database

    // Create onboarding checklist
    const checklist = new UserOnboardingChecklist();
    checklist.user = newUser;
    checklist.walletVerified = true; // Wallet verified at signup
    if (normalizedEmail) {
      checklist.emailVerified = false;
      // TODO: Send verification email
    }
    // TODO: Store in database

    this.logger.log(`User created successfully: ${newUser.id}`);

    return this.mapUserToResponse(newUser);
  }

  /**
   * Retrieves a user by ID
   *
   * @param userId - The user ID
   * @returns User object or null if not found
   */
  async getUserById(userId: string): Promise<User | null> {
    return usersDatabase.get(userId) || null;
  }

  /**
   * Retrieves a user by wallet address
   *
   * @param walletAddress - The Stellar wallet address
   * @returns User object or null if not found
   */
  async getUserByWallet(walletAddress: string): Promise<User | null> {
    const normalizedWallet =
      this.walletService.normalizeWalletAddress(walletAddress);
    const userId = walletIndex.get(normalizedWallet);
    return userId ? usersDatabase.get(userId) || null : null;
  }

  /**
   * Checks if a wallet address is already registered
   *
   * @param walletAddress - The Stellar wallet address
   * @returns true if wallet exists, false otherwise
   */
  async walletExists(walletAddress: string): Promise<boolean> {
    const normalizedWallet =
      this.walletService.normalizeWalletAddress(walletAddress);
    return walletIndex.has(normalizedWallet);
  }

  /**
   * Checks if an email is already registered
   *
   * @param email - The email address
   * @returns true if email exists, false otherwise
   */
  async emailExists(email: string): Promise<boolean> {
    const normalizedEmail = this.walletService.normalizeEmail(email);
    return emailIndex.has(normalizedEmail);
  }

  /**
   * Imports multiple users in bulk
   *
   * @param bulkImportDto - Array of wallet addresses to import
   * @returns Import result with success/failure counts
   */
  async bulkImportUsers(
    bulkImportDto: BulkUserImportDto,
  ): Promise<BulkUserImportResponseDto> {
    this.logger.log(
      `Starting bulk import of ${bulkImportDto.walletAddresses.length} users`,
    );

    const results: BulkUserImportResponseDto = {
      total: bulkImportDto.walletAddresses.length,
      successCount: 0,
      failureCount: 0,
      failures: [],
    };

    for (const walletAddress of bulkImportDto.walletAddresses) {
      try {
        // Validate wallet format
        this.walletService.validateWalletAddress(walletAddress);

        // Check if already exists
        if (await this.walletExists(walletAddress)) {
          results.failureCount++;
          results.failures.push({
            walletAddress,
            reason: 'Wallet address already exists in system',
          });
          continue;
        }

        // Create user
        const newUser = new User();
        newUser.walletAddress =
          this.walletService.normalizeWalletAddress(walletAddress);
        newUser.roles = [UserRole.USER];
        newUser.status = UserStatus.ACTIVE;
        newUser.isWalletVerified = true;
        newUser.signupSource = SignupSource.BULK_IMPORT;
        newUser.displayName = newUser.walletAddress.substring(0, 8);
        newUser.referralCode = this.walletService.generateReferralCode();

        // Store user
        usersDatabase.set(newUser.id, newUser);
        walletIndex.set(newUser.walletAddress, newUser.id);
        referralCodeIndex.set(newUser.referralCode, newUser.id);

        results.successCount++;
      } catch (error) {
        results.failureCount++;
        results.failures.push({
          walletAddress,
          reason:
            error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }

    this.logger.log(
      `Bulk import completed: ${results.successCount} success, ${results.failureCount} failures`,
    );

    return results;
  }

  /**
   * Verifies user email
   *
   * @param userId - The user ID
   * @param token - The verification token
   * @returns Updated user object
   */
  async verifyEmail(userId: string, token: string): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Validate token against stored verification token

    user.isEmailVerified = true;
    usersDatabase.set(userId, user);

    this.logger.log(`Email verified for user: ${userId}`);
    return user;
  }

  /**
   * Resends verification email
   *
   * @param userId - The user ID
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.email) {
      throw new BadRequestException('User does not have an email address');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // TODO: Generate new verification token and send email
    this.logger.log(`Resent verification email to user: ${userId}`);
  }

  /**
   * Updates user profile
   *
   * @param userId - The user ID
   * @param updateData - Partial user data to update
   * @returns Updated user object
   */
  async updateUserProfile(
    userId: string,
    updateData: Partial<User>,
  ): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only allow certain fields to be updated
    const allowedFields = ['displayName', 'email'];
    for (const field of Object.keys(updateData)) {
      if (allowedFields.includes(field)) {
        user[field] = updateData[field];
      }
    }

    user.updatedAt = new Date();
    usersDatabase.set(userId, user);

    this.logger.log(`User profile updated: ${userId}`);
    return user;
  }

  /**
   * Maps User entity to response DTO
   *
   * @param user - User entity
   * @returns SignupResponseDto
   */
  private mapUserToResponse(user: User): SignupResponseDto {
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      status: user.status,
      createdAt: user.createdAt,
      message: 'User account created successfully',
    };
  }
}
