import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { WalletService } from './services/wallet.service';
import { RateLimitGuard } from './guards/rate-limit.guard';

/**
 * Authentication Module
 *
 * Provides wallet-based user signup and account management functionality
 *
 * Features:
 * - User registration with Stellar wallet address
 * - Optional email validation and verification
 * - Referral code generation and tracking
 * - User preferences and onboarding management
 * - Rate limiting to prevent abuse
 * - Wallet address validation and normalization
 * - Bulk user import for enterprise customers
 *
 * Providers:
 * - AuthService: Main authentication service
 * - WalletService: Wallet validation and utilities
 * - RateLimitGuard: Rate limiting guard for endpoints
 *
 * Controllers:
 * - AuthController: REST endpoints for authentication
 *
 * Exports:
 * - AuthService: Can be injected in other modules
 * - WalletService: Can be injected in other modules
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, WalletService, RateLimitGuard],
  exports: [AuthService, WalletService],
})
export class AuthModule {}
