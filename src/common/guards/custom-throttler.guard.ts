import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerRequest,
} from '@nestjs/throttler';
import { Request, Response } from 'express';

/**
 * Custom throttler guard that extends the default ThrottlerGuard
 * to add rate limit headers and custom error responses.
 *
 * Features:
 * - Adds X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
 * - Custom 429 Too Many Requests response format
 * - Tracks by user ID for authenticated requests, IP for unauthenticated
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Determines the tracker key for rate limiting.
   * Uses user ID for authenticated requests, falls back to IP address.
   */
  protected async getTracker(req: Request): Promise<string> {
    // Check for authenticated user (from JWT)
    const user = (req as any).user;
    if (user?.id) {
      return `user:${user.id}`;
    }

    // Check for wallet address in request body (for auth endpoints)
    const walletAddress = req.body?.walletAddress;
    if (walletAddress) {
      return `wallet:${walletAddress}`;
    }

    // Fall back to IP address
    return this.getClientIp(req);
  }

  /**
   * Extracts client IP address from request headers or socket.
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return `ip:${forwarded.split(',')[0].trim()}`;
    }
    return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  }

  /**
   * Called after each throttle check. Adds rate limit headers to response.
   */
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const {
      context,
      limit,
      ttl,
      throttler,
      blockDuration,
      getTracker,
      generateKey,
    } = requestProps;

    const response = context.switchToHttp().getResponse<Response>();
    const request = context.switchToHttp().getRequest<Request>();

    // Get tracker for this request
    const tracker = await getTracker(request, context);
    const key = generateKey(context, tracker, throttler.name ?? 'default');

    // Get storage record
    const { totalHits, timeToExpire } = await this.storageService.increment(
      key,
      ttl,
      limit,
      blockDuration,
      throttler.name ?? 'default',
    );

    // Calculate rate limit values
    const resetTime = Math.ceil(Date.now() / 1000 + timeToExpire / 1000);
    const remaining = Math.max(0, limit - totalHits);

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetTime);
    response.setHeader(
      'X-RateLimit-Policy',
      `${limit};w=${Math.ceil(ttl / 1000)}`,
    );

    // Check if limit exceeded
    if (totalHits > limit) {
      const retryAfter = Math.ceil(timeToExpire / 1000);
      response.setHeader('Retry-After', retryAfter);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter,
          path: request.path,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
