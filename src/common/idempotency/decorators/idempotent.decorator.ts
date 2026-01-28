import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to mark an endpoint as requiring idempotency support
 * Applied to POST, PUT, or PATCH endpoints that perform critical operations
 * 
 * Usage:
 * @Post()
 * @Idempotent()
 * createClaim(@Body() dto: CreateClaimDto) { ... }
 * 
 * Requires: Idempotency-Key header in the request
 */
export const IDEMPOTENT_KEY = 'idempotent';

export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
