import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  IsUrl,
  MinLength,
  Matches,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  API_PREFIX: string;

  @IsString()
  DATABASE_HOST: string;

  @IsNumber()
  DATABASE_PORT: number;

  /**
   * Fixed: was DATABASE_USER — now matches .env.example which uses DATABASE_USERNAME.
   * If you prefer DATABASE_USER everywhere, update .env.example instead.
   */
  @IsString()
  DATABASE_USERNAME: string;

  @IsString()
  DATABASE_PASSWORD: string;

  @IsString()
  DATABASE_NAME: string;

  @IsString()
  @IsOptional()
  DATABASE_LOGGING: string = 'error,warn';

  @IsNumber()
  @IsOptional()
  DATABASE_MAX_QUERY_EXECUTION_TIME: number = 1000;

  @IsBoolean()
  @IsOptional()
  DATABASE_SSL_ENABLED: boolean = false;

  @IsBoolean()
  @IsOptional()
  DATABASE_SSL_REJECT_UNAUTHORIZED: boolean = false;

  // Redis Configuration
  @IsUrl({ protocols: ['redis', 'rediss'] })
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsNumber()
  @IsOptional()
  REDIS_DB: number = 0;

  // AWS / S3 Configuration
  @IsString()
  AWS_REGION: string;

  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  AWS_S3_BUCKET: string;

  // SendGrid Configuration
  @IsString()
  SENDGRID_API_KEY: string;

  @IsString()
  @IsOptional()
  SENDGRID_FROM_EMAIL: string = 'noreply@novafund.xyz';

  // Web Push (VAPID) Configuration
  @IsString()
  VAPID_PUBLIC_KEY: string;

  @IsString()
  VAPID_PRIVATE_KEY: string;

  @IsString()
  @IsOptional()
  VAPID_SUBJECT_EMAIL: string = 'admin@novafund.xyz';

  // Bull / background job queue (uses Redis above)
  @IsNumber()
  @IsOptional()
  EMAIL_QUEUE_MAX_ATTEMPTS: number = 5;

  @IsNumber()
  @IsOptional()
  PUSH_QUEUE_MAX_ATTEMPTS: number = 5;

  /**
   * JWT_SECRET must be:
   *  - at least 32 characters long
   *  - not a known placeholder value
   *  - contain at least one uppercase, one lowercase, one digit, and one special char
   *    (enforced via Matches — relaxed in development via custom logic below)
   *
   * Minimum complexity is checked inside validateEnv() to allow environment-specific rules.
   */
  @IsString()
  @MinLength(32, {
    message:
      'JWT_SECRET must be at least 32 characters long. Generate one with: openssl rand -base64 48',
  })
  JWT_SECRET: string;

  @IsString()
  ENCRYPTION_KEYS: string;

  /**
   * JWT_REFRESH_SECRET shares the same strength requirements as JWT_SECRET.
   */
  @IsString()
  @MinLength(32, {
    message:
      'JWT_REFRESH_SECRET must be at least 32 characters long. Generate one with: openssl rand -base64 48',
  })
  @IsOptional()
  JWT_REFRESH_SECRET: string;

  @IsNumber()
  JWT_EXPIRATION: number;

  @IsString()
  STELLAR_NETWORK: string;

  @IsUrl({ require_tld: false })
  STELLAR_HORIZON_URL: string;

  @IsString()
  STELLAR_RPC_URL: string;

  @IsString()
  STELLAR_NETWORK_PASSPHRASE: string;

  @IsString()
  PROJECT_LAUNCH_CONTRACT_ID: string;

  @IsString()
  ESCROW_CONTRACT_ID: string;

  @IsNumber()
  INDEXER_POLL_INTERVAL_MS: number;

  @IsNumber()
  @IsOptional()
  INDEXER_RETRY_ATTEMPTS: number = 3;

  @IsNumber()
  @IsOptional()
  INDEXER_RETRY_DELAY_MS: number = 1000;

  @IsNumber()
  @IsOptional()
  THROTTLE_DEFAULT_TTL: number = 900000;

  @IsNumber()
  @IsOptional()
  THROTTLE_DEFAULT_LIMIT: number = 100;

  @IsNumber()
  @IsOptional()
  THROTTLE_AUTH_TTL: number = 900000;

  @IsNumber()
  @IsOptional()
  THROTTLE_AUTH_LIMIT: number = 5;

  @IsBoolean()
  @IsOptional()
  RATE_LIMIT_REDIS_ENABLED: boolean = false;

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';

  @IsString()
  @IsOptional()
  CORS_ALLOWED_ORIGINS: string = 'http://localhost:3000,http://localhost:4200';

  @IsNumber()
  @IsOptional()
  REQUEST_TIMEOUT_MS: number = 30000;

  @IsNumber()
  @IsOptional()
  HEADERS_TIMEOUT_MS: number = 60000;

  @IsNumber()
  @IsOptional()
  KEEP_ALIVE_TIMEOUT_MS: number = 65000;
}

/** Placeholder values that must never be used in production. */
const WEAK_JWT_PLACEHOLDERS = [
  'your-jwt-secret-key-change-in-production',
  'your-refresh-secret-key-change-in-production',
  'secret',
  'changeme',
  'password',
];

function assertJwtStrength(
  value: string,
  fieldName: string,
  env: Environment,
): void {
  const lower = value.toLowerCase();

  if (WEAK_JWT_PLACEHOLDERS.some(p => lower.includes(p))) {
    throw new Error(
      `${fieldName} contains a placeholder value. ` +
        `Replace it with a strong random secret: openssl rand -base64 48`,
    );
  }

  if (env === Environment.Production) {
    // In production, enforce character-class complexity.
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasDigit = /[0-9]/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      throw new Error(
        `${fieldName} does not meet production complexity requirements. ` +
          `It must contain uppercase, lowercase, digit, and special characters. ` +
          `Generate one with: openssl rand -base64 48`,
      );
    }
  }
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  // Additional JWT secret strength checks that go beyond simple decorator rules.
  assertJwtStrength(
    validatedConfig.JWT_SECRET,
    'JWT_SECRET',
    validatedConfig.NODE_ENV,
  );

  if (validatedConfig.JWT_REFRESH_SECRET) {
    assertJwtStrength(
      validatedConfig.JWT_REFRESH_SECRET,
      'JWT_REFRESH_SECRET',
      validatedConfig.NODE_ENV,
    );
  }

  return validatedConfig;
}
