import { Controller, Post, HttpCode, HttpStatus, Version } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { NonceService } from './nonce.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * NonceController
 *
 * Exposes a single public endpoint that clients call to obtain a fresh nonce
 * before performing sensitive operations (e.g. wallet-signed authentication).
 *
 * POST /nonce  →  { nonce: string, expiresInMs: number }
 *
 * The nonce is stored in Redis with a 5-minute TTL and consumed (deleted) by
 * NonceService.consumeNonce() inside the relevant auth guard / strategy.
 */
@ApiTags('Nonce')
@SkipThrottle({ default: true })
@Throttle({ auth: {} })
@Controller({ path: 'nonce', version: '1' })
export class NonceController {
  constructor(private readonly nonceService: NonceService) {}

  /**
   * Issue a new one-time nonce.
   * Marked @Public() so it is reachable without a JWT.
   * Rate-limited by the named `auth` throttler (THROTTLE_AUTH_*).
   */
  @Public()
  @Version('1')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue a one-time authentication nonce' })
  @ApiCreatedResponse({
    description: 'Returns a new nonce and expiration in milliseconds',
    schema: {
      example: {
        nonce: 'abc123',
        expiresInMs: 300000,
      },
    },
  })
  async issueNonce(): Promise<{ nonce: string; expiresInMs: number }> {
    const nonce = await this.nonceService.generateNonce();
    return {
      nonce,
      expiresInMs: 5 * 60 * 1000, // must match NONCE_TTL_MS in NonceService
    };
  }
}
