import { z } from 'zod';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** Placeholder values that must never be used in production. */
const WEAK_JWT_PLACEHOLDERS = [
  'your-jwt-secret-key-change-in-production',
  'your-refresh-secret-key-change-in-production',
  'secret',
  'changeme',
  'password',
];

const EnvironmentEnum = z.nativeEnum(Environment);

const envSchema = z.object({
  NODE_ENV: EnvironmentEnum,

  PORT: z.coerce.number(),

  API_PREFIX: z.string(),

  // Database Configuration
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.coerce.number(),
  DATABASE_USERNAME: z.string(),
  DATABASE_PASSWORD: z.string(),
  DATABASE_NAME: z.string(),
  DATABASE_LOGGING: z.string().default('error,warn'),
  DATABASE_MAX_QUERY_EXECUTION_TIME: z.coerce.number().default(1000),
  DATABASE_SSL_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1')
    .pipe(z.boolean()),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1')
    .pipe(z.boolean()),

  // Redis Configuration
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_DB: z.coerce.number().default(0),

  // AWS / S3 Configuration
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET: z.string(),

  // SendGrid Configuration
  SENDGRID_API_KEY: z.string(),
  SENDGRID_FROM_EMAIL: z.string().default('noreply@novafund.xyz'),

  // Web Push (VAPID) Configuration
  VAPID_PUBLIC_KEY: z.string(),
  VAPID_PRIVATE_KEY: z.string(),
  VAPID_SUBJECT_EMAIL: z.string().default('admin@novafund.xyz'),

  // Bull / background job queue (uses Redis above)
  EMAIL_QUEUE_MAX_ATTEMPTS: z.coerce.number().default(5),
  PUSH_QUEUE_MAX_ATTEMPTS: z.coerce.number().default(5),

  // JWT Configuration
  JWT_SECRET: z
    .string()
    .min(32, {
      message:
        'JWT_SECRET must be at least 32 characters long. Generate one with: openssl rand -base64 48',
    }),
  ENCRYPTION_KEYS: z.string(),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, {
      message:
        'JWT_REFRESH_SECRET must be at least 32 characters long. Generate one with: openssl rand -base64 48',
    })
    .optional(),
  JWT_EXPIRATION: z.coerce.number(),

  // Stellar Configuration
  STELLAR_NETWORK: z.string(),
  STELLAR_HORIZON_URL: z.string().url({ message: 'STELLAR_HORIZON_URL must be a valid URL' }),
  STELLAR_RPC_URL: z.string(),
  STELLAR_NETWORK_PASSPHRASE: z.string(),
  PROJECT_LAUNCH_CONTRACT_ID: z.string(),
  ESCROW_CONTRACT_ID: z.string(),

  // Indexer Configuration
  INDEXER_POLL_INTERVAL_MS: z.coerce.number(),
  INDEXER_RETRY_ATTEMPTS: z.coerce.number().default(3),
  INDEXER_RETRY_DELAY_MS: z.coerce.number().default(1000),

  // Throttle / Rate limiting configuration
  THROTTLE_DEFAULT_TTL: z.coerce.number().default(900000),
  THROTTLE_DEFAULT_LIMIT: z.coerce.number().default(100),
  THROTTLE_AUTH_TTL: z.coerce.number().default(900000),
  THROTTLE_AUTH_LIMIT: z.coerce.number().default(5),
  RATE_LIMIT_REDIS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1')
    .pipe(z.boolean()),

  // Logging
  LOG_LEVEL: z.string().default('info'),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:4200'),

  // HTTP Server timeouts
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30000),
  HEADERS_TIMEOUT_MS: z.coerce.number().default(60000),
  KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().default(65000),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;

function assertJwtStrength(
  value: string,
  fieldName: string,
  env: Environment,
): void {
  const lower = value.toLowerCase();

  if (WEAK_JWT_PLACEHOLDERS.some((p) => lower.includes(p))) {
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
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(errors.join('\n'));
  }

  const validatedConfig = result.data;

  // Additional JWT secret strength checks that go beyond simple schema rules.
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