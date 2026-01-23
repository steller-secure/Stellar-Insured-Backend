import {
  Inject,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { UsersService, User } from '../users/users.service';
import * as crypto from 'crypto';
import { Keypair } from 'stellar-sdk';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async generateChallenge(walletAddress: string) {
    this.logger.log(`Generating login challenge for wallet ${walletAddress}`);
    // 1. Validate wallet address (Basic check handled by DTO, but ensure basic length/format)

    // 2. Generate Nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);

    const message = `Sign this message to login to InsuranceDAO\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

    // 3. Store in Cache
    const key = `auth:challenge:${walletAddress}`;
    const ttl = 10 * 60 * 1000; // 10 minutes in milliseconds

    await this.cacheManager.set(key, { nonce, timestamp, message }, ttl);

    // 4. Return response
    const expiresAt = new Date((timestamp + 600) * 1000).toISOString();

    return {
      challenge: message,
      expiresAt,
    };
  }

  async login(walletAddress: string, signature: string) {
    this.logger.log(`Login attempt for wallet ${walletAddress}`);

    // Check Lockout
    const lockoutKey = `auth:lockout:${walletAddress}`;
    const failures = (await this.cacheManager.get<number>(lockoutKey)) || 0;
    if (failures >= 5) {
      this.logger.warn(
        `Wallet ${walletAddress} is locked out due to too many failed attempts`,
      );
      throw new BadRequestException(
        'Wallet is temporarily locked due to too many failed attempts. Try again in 15 minutes.',
      );
    }

    const key = `auth:challenge:${walletAddress}`;
    const cached: any = await this.cacheManager.get(key);

    if (!cached) {
      throw new NotFoundException('Challenge not found or expired');
    }

    const { message, timestamp } = cached;

    // Verify timestamp (5 minute window check)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp - timestamp > 300) {
      // 300 seconds = 5 mins
      await this.incrementFailure(walletAddress);
      throw new BadRequestException('Challenge expired (5 minute window)');
    }

    // Verify Signature
    try {
      const keypair = Keypair.fromPublicKey(walletAddress);

      const messageBuffer = Buffer.from(message);
      const signatureBuffer = Buffer.from(signature, 'base64');

      const isValid = keypair.verify(messageBuffer, signatureBuffer);

      if (!isValid) {
        await this.incrementFailure(walletAddress);
        this.logger.warn(`Invalid signature for wallet ${walletAddress}`);
        throw new UnauthorizedException('Invalid signature');
      }
    } catch (error: any) {
      await this.incrementFailure(walletAddress);
      this.logger.error(
        `Signature verification failed for ${walletAddress}: ${error.message}`,
      );

      throw new UnauthorizedException(
        'Signature verification failed: ' + error.message,
      );
    }

    // Check User
    const user = await this.usersService.findByWalletAddress(walletAddress);
    if (!user) {
      this.logger.warn(`Wallet ${walletAddress} not registered`);
      throw new NotFoundException('User not found. Wallet not registered.');
    }

    // Invalidate Nonce (Replay Attack Prevention)
    await this.cacheManager.del(key);
    // Clear failures on success
    await this.cacheManager.del(lockoutKey);

    this.logger.log(`Login successful for user ${user.id} (${walletAddress})`);

    // Generate Tokens
    return this.generateTokens(user);
  }

  private async incrementFailure(walletAddress: string) {
    const lockoutKey = `auth:lockout:${walletAddress}`;
    const failures =
      ((await this.cacheManager.get<number>(lockoutKey)) || 0) + 1;
    const ttl = 15 * 60 * 1000; // 15 minutes
    await this.cacheManager.set(lockoutKey, failures, ttl);
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload);

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 86400, // 24 hours
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        email: user.email,
        roles: user.roles,
      },
    };
  }
}
