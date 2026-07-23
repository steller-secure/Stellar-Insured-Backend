import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Global rate-limit guard, registered alongside JwtAuthGuard via APP_GUARD.
 *
 * Named throttlers configured in AppModule:
 * - `default` — general API traffic (THROTTLE_DEFAULT_*)
 * - `auth` — auth-sensitive routes (THROTTLE_AUTH_*)
 *
 * Both named throttlers are evaluated on every request unless skipped.
 * Use `@SkipThrottle({ auth: true })` on general controllers and
 * `@SkipThrottle({ default: true })` on auth routes so only the
 * intended limiter applies.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {}
