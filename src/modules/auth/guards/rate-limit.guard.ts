import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * In-memory store for rate limiting
 * In production, use Redis for distributed rate limiting
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Rate limiting guard to prevent abuse of signup and authentication endpoints
 * Uses in-memory storage (for development); use Redis in production
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  /**
   * In-memory store for rate limits
   * Key: IP address + endpoint
   * Value: { count, resetTime }
   */
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();

  /**
   * Maximum requests per window
   * @default 5 requests per minute for signup
   */
  private readonly MAX_REQUESTS = 5;

  /**
   * Rate limit window in milliseconds
   * @default 60 seconds
   */
  private readonly WINDOW_MS = 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    const endpoint = request.path;
    const key = `${clientIp}:${endpoint}`;

    const now = Date.now();
    const entry = this.rateLimitStore.get(key);

    if (!entry) {
      // First request from this client
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.WINDOW_MS,
      });
      return true;
    }

    if (now > entry.resetTime) {
      // Window has reset
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.WINDOW_MS,
      });
      return true;
    }

    // Window is still active
    entry.count++;

    if (entry.count > this.MAX_REQUESTS) {
      const remainingTime = Math.ceil(
        (entry.resetTime - now) / 1000,
      );
      this.logger.warn(
        `Rate limit exceeded for IP: ${clientIp} on endpoint: ${endpoint}`,
      );
      throw new HttpException(
       `Too many requests. Please try again in ${remainingTime} seconds.`,
       HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  /**
   * Extracts client IP address from request
   *
   * @param request - Express request object
   * @returns Client IP address
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  /**
   * Cleanup old entries (run periodically in production)
   * This prevents memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.rateLimitStore.forEach((value, key) => {
      if (now > value.resetTime + this.WINDOW_MS) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.rateLimitStore.delete(key));
    this.logger.debug(`Cleaned up ${keysToDelete.length} rate limit entries`);
  }
}
