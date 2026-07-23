import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NonceService } from './nonce.service';
import { NonceController } from './nonce.controller';

/**
 * NonceModule
 *
 * Previously, NonceService existed without a module — making it impossible to
 * inject anywhere and rendering replay-attack prevention completely non-functional.
 *
 * This module:
 *  1. Registers NonceService with CacheModule backed by Redis (via ConfigService).
 *  2. Exports NonceService so AuthModule / guards can consume nonces.
 *  3. Exposes a single POST /nonce endpoint to issue nonces to clients.
 */
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // Dynamically import the Redis store to avoid hard-wiring the dependency
        // in environments that don't have Redis (e.g., unit tests with an in-memory store).
        const redisEnabled = configService.get<boolean>(
          'RATE_LIMIT_REDIS_ENABLED',
          false,
        );

        if (redisEnabled) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { redisStore } = require('cache-manager-redis-yet');
          return {
            store: redisStore,
            url: configService.get<string>(
              'REDIS_URL',
              'redis://localhost:6379',
            ),
            ttl: configService.get<number>('REDIS_TTL', 3600) * 1000,
          };
        }

        // Fall back to in-memory cache for development / testing.
        return {
          ttl: 300 * 1000, // 5 minutes
          max: 10000,
        };
      },
    }),
  ],
  controllers: [NonceController],
  providers: [NonceService],
  exports: [NonceService],
})
export class NonceModule {}
