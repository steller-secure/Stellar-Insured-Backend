import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';

import appConfig from './config/app.config';
import notificationConfig from './config/notification.config';
import storageConfig from './config/storage.config';

import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { NonceModule } from './nonce/nonce.module';         // ← NEW
import { ReputationModule } from './reputation/reputation.module';
import { DatabaseModule } from './database.module';
import { IndexerModule } from './indexer/indexer.module';
import { NotificationModule } from './notification/notification.module';
import { EncryptionModule } from './encryption/encryption.module';
import { StorageModule } from './storage/storage.module';
import { InsuranceModule } from './insurance/insurance.module';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AppThrottlerGuard } from './auth/guards/app-throttler.guard';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { PrismaHealthIndicator } from './common/health/prisma.health';

// ← NEW: global exception filter for standardised error responses
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response.interceptor';
import { IdempotencyCleanupTask } from './interceptors/tasks/idempotency-cleanup.task';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
      load: [appConfig, notificationConfig, storageConfig],
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('THROTTLE_DEFAULT_TTL', 900000),
            limit: configService.get<number>('THROTTLE_DEFAULT_LIMIT', 100),
          },
          {
            name: 'auth',
            ttl: configService.get<number>('THROTTLE_AUTH_TTL', 900000),
            limit: configService.get<number>('THROTTLE_AUTH_LIMIT', 5),
          },
        ],
      }),
    }),

    TerminusModule,
    HttpModule,

    // Feature modules
    AuthModule,
    UserModule,
    NonceModule,           // ← NEW: nonce replay-prevention now wired in
    ReputationModule,
    DatabaseModule,
    IndexerModule,
    NotificationModule,
    EncryptionModule,
    StorageModule,
    InsuranceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaHealthIndicator,

    // Global rate limiting — ThrottlerModule config is inert without this guard.
    // Registered before JwtAuthGuard so excess traffic is rejected cheaply.
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },

    // Global JWT guard — decorators like @Public() opt routes out.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Idempotency cleanup task - removes stale keys daily
    IdempotencyCleanupTask,
    
    // Global exception filter — all thrown exceptions return ErrorResponseDto.
    // This replaces the four inconsistent error formats previously in the codebase.
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  // Also applied directly via app.use() in main.ts, ahead of expressWinston's
  // request logger, so production request logs are covered too. Kept here as
  // well so any TestingModule built directly from AppModule (bypassing
  // main.ts's bootstrap) still gets a tracing scope for its requests.
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}