import { Global, Module, Logger } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule } from '../../config/config.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { ConfigModule } from 'src/config/config.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: AppConfigService) => ({
        type: 'postgres',
        host: configService.databaseHost,
        port: configService.databasePort,
        username: configService.databaseUsername,
        password: configService.databasePassword,
        database: configService.databaseName,
        autoLoadEntities: true,
        synchronize: configService.isDevelopment,
        logging: configService.isDevelopment,
      }),
      inject: [AppConfigService],
      useFactory: async (configService: AppConfigService): Promise<TypeOrmModuleOptions> => {
        const logger = new Logger('DatabaseModule');

        // SSL Configuration
        const ssl = configService.databaseSslEnabled
          ? {
              rejectUnauthorized: configService.databaseSslRejectUnauthorized,
              ca: configService.databaseSslCa,
              cert: configService.databaseSslCert,
              key: configService.databaseSslKey,
            }
          : false;

        // Log SSL configuration (without sensitive details)
        if (configService.databaseSslEnabled) {
          logger.log('SSL/TLS encryption enabled for database connection');
          logger.log(
            `SSL certificate validation: ${configService.databaseSslRejectUnauthorized ? 'enforced' : 'disabled'}`,
          );
        } else {
          logger.warn('SSL/TLS encryption is disabled - not recommended for production');
        }

        // Connection Pool Configuration
        const poolConfig = {
          min: configService.databasePoolMin,
          max: configService.databasePoolMax,
          idleTimeoutMillis: configService.databasePoolIdleTimeout,
          connectionTimeoutMillis: configService.databasePoolConnectionTimeout,
        };

        logger.log(
          `Connection pool configured: min=${poolConfig.min}, max=${poolConfig.max}, idle=${poolConfig.idleTimeoutMillis}ms`,
        );

        // Retry Configuration with Exponential Backoff
        const retryAttempts = configService.databaseRetryAttempts;
        const retryDelay = configService.databaseRetryDelay;
        const maxRetryDelay = configService.databaseMaxRetryDelay;

        logger.log(
          `Retry configuration: attempts=${retryAttempts}, initialDelay=${retryDelay}ms, maxDelay=${maxRetryDelay}ms`,
        );

        // Build TypeORM configuration
        const config: TypeOrmModuleOptions = {
          type: 'postgres',
          host: configService.databaseHost,
          port: configService.databasePort,
          username: configService.databaseUsername,
          password: configService.databasePassword,
          database: configService.databaseName,

          // Entity Management
          autoLoadEntities: true,
          synchronize: configService.isDevelopment, // CRITICAL: Only in development

          // SSL/TLS Configuration
          ssl: ssl,

          // Connection Pool Configuration
          extra: {
            ...poolConfig,
            // Additional PostgreSQL-specific options
            statement_timeout: 30000, // 30 seconds
            query_timeout: 30000,
            application_name: configService.appName || 'stellar-insured-backend',
          },

          // Retry Logic with Exponential Backoff
          retryAttempts: retryAttempts,
          retryDelay: retryDelay,
          maxRetryDelay: maxRetryDelay,

          // Logging Configuration
          logging: configService.databaseLogging,
          maxQueryExecutionTime: configService.databaseMaxQueryExecutionTime,
          logger: 'advanced-console', // Use advanced console logger for better formatting

          // Connection Lifecycle Events
          subscribers: [],
          migrations: [],

          // Performance Optimization
          cache: false, // Disable default cache, use Redis instead
          dropSchema: false, // NEVER drop schema automatically
        };

        // Log connection configuration (without sensitive data)
        logger.log(`Connecting to PostgreSQL database at ${configService.databaseHost}:${configService.databasePort}`);
        logger.log(`Database: ${configService.databaseName}`);
        logger.log(`Environment: ${configService.nodeEnv}`);

        // CRITICAL: Warn if synchronize is enabled in production
        if (configService.isProduction && config.synchronize) {
          logger.error(
            '⚠️  CRITICAL: Database synchronization is ENABLED in PRODUCTION! This can lead to data loss!',
          );
          throw new Error('Database synchronization must be disabled in production');
        }

        return config;
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
