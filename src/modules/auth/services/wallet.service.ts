import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Wallet validation and utility service for Stellar blockchain operations
 */
@Injectable()
export class WalletService {
  /**
   * Stellar public key regex pattern
   * Format: G followed by 56 alphanumeric characters (A-Z, 2-7)
   */
  private readonly STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{56}$/;

  /**
   * Email validation regex pattern
   */
  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Validates if the provided address is a valid Stellar public key
   *
   * @param walletAddress - The wallet address to validate
   * @returns true if valid, throws BadRequestException if invalid
   * @throws BadRequestException if wallet address format is invalid
   */
  validateWalletAddress(walletAddress: string): boolean {
    if (!walletAddress) {
      throw new BadRequestException('Wallet address is required');
    }

    const trimmedAddress = walletAddress.trim();

    if (!this.STELLAR_PUBLIC_KEY_REGEX.test(trimmedAddress)) {
      throw new BadRequestException(
        'Invalid Stellar public key format. Must start with G followed by 56 characters from A-Z and 2-7.',
      );
    }

    return true;
  }

  /**
   * Validates email format
   *
   * @param email - The email address to validate
   * @returns true if valid, throws BadRequestException if invalid
   * @throws BadRequestException if email format is invalid
   */
  validateEmail(email: string): boolean {
    if (!email) {
      return true; // Email is optional
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!this.EMAIL_REGEX.test(trimmedEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    // Additional validation: check email length
    if (trimmedEmail.length > 254) {
      throw new BadRequestException('Email address is too long');
    }

    return true;
  }

  /**
   * Generates a unique referral code
   *
   * @returns A 6-character uppercase alphanumeric referral code
   */
  generateReferralCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  }

  /**
   * Validates a signed message to prove wallet ownership
   *
   * @param walletAddress - The Stellar wallet address
   * @param message - The original message
   * @param signature - The signed message/signature
   * @returns true if signature is valid
   */
  validateSignedMessage(
    walletAddress: string,
    message: string,
    signature: string,
  ): boolean {
    // This is a placeholder for Stellar-specific signature verification
    // In a production environment, you would use StellarSDK to verify
    // the signature against the wallet address

    try {
      // Basic validation: check if all parameters are provided
      if (!walletAddress || !message || !signature) {
        throw new BadRequestException(
          'Missing required parameters for signature verification',
        );
      }

      // TODO: Implement actual Stellar signature verification using stellar-sdk
      // This would involve:
      // 1. Decoding the signature
      // 2. Recovering the public key from the signature
      // 3. Comparing with the provided wallet address

      return true;
    } catch (error) {
      throw new BadRequestException(
        'Invalid signature or message verification failed',
      );
    }
  }

  /**
   * Generates an email verification token
   *
   * @returns A secure random token
   */
  generateEmailVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a simple CAPTCHA challenge
   *
   * @returns Object with question and answer
   */
  generateSimpleCaptcha(): { question: string; answer: string } {
    const operations = [
      { question: 'What is 2 + 3?', answer: '5' },
      { question: 'What is 5 + 7?', answer: '12' },
      { question: 'What is 10 - 4?', answer: '6' },
      { question: 'What is 3 × 4?', answer: '12' },
      { question: 'What is 8 ÷ 2?', answer: '4' },
      { question: 'What is 15 - 7?', answer: '8' },
      { question: 'What is 6 + 9?', answer: '15' },
      { question: 'What is 12 ÷ 3?', answer: '4' },
    ];

    const random = operations[Math.floor(Math.random() * operations.length)];
    return {
      question: random.question,
      answer: random.answer,
    };
  }

  /**
   * Validates a CAPTCHA response
   *
   * @param question - The CAPTCHA question
   * @param answer - The provided answer
   * @param correctAnswer - The correct answer
   * @returns true if answer is correct
   */
  validateCaptcha(
    question: string,
    answer: string,
    correctAnswer: string,
  ): boolean {
    if (!answer || !correctAnswer) {
      throw new BadRequestException('CAPTCHA validation failed');
    }

    return answer.trim() === correctAnswer.trim();
  }

  /**
   * Normalizes a wallet address (trim and uppercase)
   *
   * @param walletAddress - The wallet address to normalize
   * @returns Normalized wallet address
   */
  normalizeWalletAddress(walletAddress: string): string {
    return walletAddress.trim().toUpperCase();
  }

  /**
   * Normalizes an email address (trim and lowercase)
   *
   * @param email - The email address to normalize
   * @returns Normalized email address
   */
  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Checks if an address looks like a Stellar address (basic check)
   *
   * @param address - The address to check
   * @returns true if it looks like a Stellar address
   */
  isStellarAddress(address: string): boolean {
    return this.STELLAR_PUBLIC_KEY_REGEX.test(address);
  }

  /**
   * Masks a wallet address for display (shows first and last 8 characters)
   *
   * @param walletAddress - The wallet address to mask
   * @returns Masked wallet address
   */
  maskWalletAddress(walletAddress: string): string {
    if (!walletAddress || walletAddress.length < 16) {
      return '****';
    }

    const first = walletAddress.substring(0, 8);
    const last = walletAddress.substring(walletAddress.length - 8);
    return `${first}...${last}`;
  }
}
