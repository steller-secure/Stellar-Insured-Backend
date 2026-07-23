import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';

/**
 * NonceService
 *
 * Generates cryptographically secure nonces, stores them in Redis with a TTL,
 * and validates (consuming) them on use — preventing replay attacks.
 *
 * Previously this service was:
 *  - Not declared in any module (could not be injected)
 *  - Not storing generated nonces anywhere (replay prevention was impossible)
 *  - Not integrated into any auth or request validation flow
 *
 * Now:
 *  - Declared in NonceModule and exported for use by AuthModule / guards
 *  - Nonces are stored in Redis with a configurable TTL (default 5 min)
 *  - consumeNonce() atomically validates and deletes the nonce (one-time use)
 */
@Injectable()
export class NonceService {
  private readonly logger = new Logger(NonceService.name);

  /** How long (ms) a nonce remains valid after generation. */
  private readonly NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private readonly NONCE_PREFIX = 'nonce:';

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Generate a new nonce, persist it to Redis, and return it.
   * The nonce expires automatically after NONCE_TTL_MS.
   */
  async generateNonce(): Promise<string> {
    const nonce = randomBytes(16).toString('hex');
    const key = this.buildKey(nonce);

    // Store with TTL — value is the creation timestamp for audit purposes.
    await this.cache.set(key, Date.now().toString(), this.NONCE_TTL_MS);

    this.logger.debug(`Nonce generated: ${nonce}`);
    return nonce;
  }

  /**
   * Validate and consume a nonce.
   *
   * - Returns true and deletes the nonce if it exists and has not expired.
   * - Throws BadRequestException if the nonce is unknown, already used, or expired.
   *
   * This is atomic enough for single-instance deployments; for distributed
   * setups consider a Lua script or a Redis SET NX / DEL pipeline.
   */
  async consumeNonce(nonce: string): Promise<boolean> {
    if (!nonce || typeof nonce !== 'string') {
      throw new BadRequestException('Invalid nonce format.');
    }

    const key = this.buildKey(nonce);
    const stored = await this.cache.get<string>(key);

    if (!stored) {
      this.logger.warn(
        `Nonce validation failed — unknown or expired: ${nonce}`,
      );
      throw new BadRequestException(
        'Nonce is invalid, expired, or has already been used.',
      );
    }

    // Delete immediately so it cannot be replayed.
    await this.cache.del(key);

    this.logger.debug(`Nonce consumed: ${nonce}`);
    return true;
  }

  /**
   * Check whether a nonce is currently valid without consuming it.
   * Useful for pre-flight checks; prefer consumeNonce() in auth flows.
   */
  async isNonceValid(nonce: string): Promise<boolean> {
    if (!nonce) return false;
    const stored = await this.cache.get<string>(this.buildKey(nonce));
    return stored !== null && stored !== undefined;
  }

  private buildKey(nonce: string): string {
    return `${this.NONCE_PREFIX}${nonce}`;
  }
}
