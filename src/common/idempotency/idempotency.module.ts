import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyKeyEntity } from './entities/idempotency-key.entity';
import { IdempotencyService } from './idempotency.service';

/**
 * Idempotency Module
 * Provides idempotency key support for critical endpoints
 * 
 * Features:
 * - Request deduplication
 * - Safe replay handling
 * - Time-bound storage with automatic cleanup
 * - Concurrent request handling
 * - Clear error responses
 * 
 * Usage:
 * 1. Import this module in AppModule
 * 2. Register IdempotencyInterceptor globally
 * 3. Add @Idempotent decorator to critical endpoints
 * 4. Clients must provide Idempotency-Key header for marked endpoints
 */
@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKeyEntity])],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
