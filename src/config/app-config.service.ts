import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) {}

  get(propertyPath: string, defaultValue?: any): any {
    return this.configService.get(propertyPath, defaultValue);
  }

  getOptional(propertyPath: string, defaultValue?: any): any {
    return this.configService.get(propertyPath, defaultValue);
  }

  // Application Configuration
  get appName(): string {
    return this.configService.get<string>(
      'APP_NAME',
      'Stellar Insured Backend',
    );
  }

  get appVersion(): string {
    return this.configService.get<string>('APP_VERSION', '1.0.0');
  }

  get port(): number {
    return this.configService.get<number>('PORT', 4000);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  // Database Configuration
  get databaseUrl(): string {
    return this.configService.get<string>(
      'DATABASE_URL',
      'postgresql://user:password@localhost:5432/stellar_insured',
    );
  }

  get databaseHost(): string {
    return this.configService.get<string>('DATABASE_HOST', 'localhost');
  }

  get databasePort(): number {
    return this.configService.get<number>('DATABASE_PORT', 5432);
  }

  get databaseUsername(): string {
    return this.configService.get<string>('DATABASE_USERNAME', 'user');
  }

  get databasePassword(): string {
    return this.configService.get<string>('DATABASE_PASSWORD', 'password');
  }

  get databaseName(): string {
    return this.configService.get<string>('DATABASE_NAME', 'stellar_insured');
  }

  // Database SSL Configuration
  get databaseSslEnabled(): boolean {
    return this.configService.get<boolean>('DATABASE_SSL_ENABLED', !this.isDevelopment);
  }

  get databaseSslRejectUnauthorized(): boolean {
    return this.configService.get<boolean>('DATABASE_SSL_REJECT_UNAUTHORIZED', this.isProduction);
  }

  get databaseSslCa(): string | undefined {
    return this.configService.get<string>('DATABASE_SSL_CA');
  }

  get databaseSslCert(): string | undefined {
    return this.configService.get<string>('DATABASE_SSL_CERT');
  }

  get databaseSslKey(): string | undefined {
    return this.configService.get<string>('DATABASE_SSL_KEY');
  }

  // Database Connection Pool Configuration
  get databasePoolMin(): number {
    return this.configService.get<number>('DATABASE_POOL_MIN', 2);
  }

  get databasePoolMax(): number {
    return this.configService.get<number>('DATABASE_POOL_MAX', 10);
  }

  get databasePoolIdleTimeout(): number {
    return this.configService.get<number>('DATABASE_POOL_IDLE_TIMEOUT', 30000);
  }

  get databasePoolConnectionTimeout(): number {
    return this.configService.get<number>('DATABASE_POOL_CONNECTION_TIMEOUT', 2000);
  }

  // Database Retry Configuration
  get databaseRetryAttempts(): number {
    return this.configService.get<number>('DATABASE_RETRY_ATTEMPTS', 3);
  }

  get databaseRetryDelay(): number {
    return this.configService.get<number>('DATABASE_RETRY_DELAY', 1000);
  }

  get databaseMaxRetryDelay(): number {
    return this.configService.get<number>('DATABASE_MAX_RETRY_DELAY', 30000);
  }

  // Database Logging Configuration
  get databaseLogging(): boolean | 'all' | Array<'query' | 'error' | 'schema' | 'warn' | 'info' | 'log' | 'migration'> {
    const loggingConfig = this.configService.get<string>('DATABASE_LOGGING');

    if (!loggingConfig) {
      // Default: minimal logging in production, all in development
      return this.isDevelopment ? 'all' : ['error', 'warn', 'migration'];
    }

    if (loggingConfig === 'true') return true;
    if (loggingConfig === 'false') return false;
    if (loggingConfig === 'all') return 'all';

    return loggingConfig.split(',') as Array<'query' | 'error' | 'schema' | 'warn' | 'info' | 'log' | 'migration'>;
  }

  get databaseMaxQueryExecutionTime(): number {
    return this.configService.get<number>('DATABASE_MAX_QUERY_EXECUTION_TIME', 1000);
  }

  // Redis Configuration
  get redisUrl(): string {
    return this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
  }

  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST', 'localhost');
  }

  get redisPort(): number {
    return this.configService.get<number>('REDIS_PORT', 6379);
  }

  get redisPassword(): string {
    return this.configService.get<string>('REDIS_PASSWORD', '');
  }

  get redisTtl(): number {
    return this.configService.get<number>('REDIS_TTL', 3600);
  }

  // Stellar Configuration
  get stellarNetwork(): string {
    return this.configService.get<string>('STELLAR_NETWORK', 'testnet');
  }

  get stellarHorizonUrl(): string {
    return this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org',
    );
  }

  get stellarPassphrase(): string {
    return this.configService.get<string>(
      'STELLAR_PASSPHRASE',
      'Test SDF Network ; September 2015',
    );
  }

  // Security Configuration
  get jwtSecret(): string {
    return this.configService.get<string>(
      'JWT_SECRET',
      'my-super-secret-jwt-key-for-development-only',
    );
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '24h');
  }

  get bcryptSaltRounds(): number {
    return this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12);
  }

  // Logging Configuration
  get logLevel(): string {
    return this.configService.get<string>('LOG_LEVEL', 'debug');
  }

  get logFormat(): string {
    return this.configService.get<string>('LOG_FORMAT', 'json');
  }

  // CORS Configuration
  get corsOrigin(): string | string[] {
    const origin = this.configService.get<string>(
      'CORS_ORIGIN',
      'http://localhost:3000',
    );
    return origin ? origin.split(',') : '*';
  }

  get corsCredentials(): boolean {
    return this.configService.get<boolean>('CORS_CREDENTIALS', true);
  }

  // Rate Limiting - Default (100 requests per 15 minutes)
  get throttleDefaultTtl(): number {
    return this.configService.get<number>('THROTTLE_DEFAULT_TTL', 900000); // 15 minutes in ms
  }

  get throttleDefaultLimit(): number {
    return this.configService.get<number>('THROTTLE_DEFAULT_LIMIT', 100);
  }

  // Rate Limiting - Authentication (5 requests per 15 minutes)
  get throttleAuthTtl(): number {
    return this.configService.get<number>('THROTTLE_AUTH_TTL', 900000); // 15 minutes in ms
  }

  get throttleAuthLimit(): number {
    return this.configService.get<number>('THROTTLE_AUTH_LIMIT', 5);
  }

  // Rate Limiting - Public endpoints (50 requests per minute)
  get throttlePublicTtl(): number {
    return this.configService.get<number>('THROTTLE_PUBLIC_TTL', 60000); // 1 minute in ms
  }

  get throttlePublicLimit(): number {
    return this.configService.get<number>('THROTTLE_PUBLIC_LIMIT', 50);
  }

  // Rate Limiting - Admin endpoints (100 requests per minute)
  get throttleAdminTtl(): number {
    return this.configService.get<number>('THROTTLE_ADMIN_TTL', 60000); // 1 minute in ms
  }

  get throttleAdminLimit(): number {
    return this.configService.get<number>('THROTTLE_ADMIN_LIMIT', 100);
  }

  // Rate Limiting - Claims (10 per hour)
  get throttleClaimsTtl(): number {
    return this.configService.get<number>('THROTTLE_CLAIMS_TTL', 3600000); // 1 hour in ms
  }

  get throttleClaimsLimit(): number {
    return this.configService.get<number>('THROTTLE_CLAIMS_LIMIT', 10);
  }

  // Legacy rate limiting (kept for backward compatibility)
  get rateLimitTtl(): number {
    return this.configService.get<number>('RATE_LIMIT_TTL', 60);
  }

  get rateLimitMax(): number {
    return this.configService.get<number>('RATE_LIMIT_MAX', 100);
  }

  // Swagger Configuration
  get swaggerEnabled(): boolean {
    return this.configService.get<boolean>('SWAGGER_ENABLED', true);
  }

  get swaggerPath(): string {
    return this.configService.get<string>('SWAGGER_PATH', '/api/docs');
  }
}
