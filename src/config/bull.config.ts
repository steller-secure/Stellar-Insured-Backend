import { ConfigService } from '@nestjs/config';
import { BullModuleOptions } from '@nestjs/bull';

/**
 * Builds a shared Bull connection config from environment variables.
 * Falls back to the local Redis defaults already defined in .env.example.
 */
export function bullConfig(config: ConfigService): BullModuleOptions {
  const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const db = config.get<number>('REDIS_DB', 0);

  // Bull supports passing a redis URL directly via the url property,
  // or we can parse the URL. Bull's redis option accepts an ioredis connection options object.
  // Using the url property is the most direct way to configure it.
  return {
    url: redisUrl,
    redis: {
      db,
    },
  };
}
