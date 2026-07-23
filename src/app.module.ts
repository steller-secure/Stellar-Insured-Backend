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

import { DomainEventBusModule } from './common/events/domain-event-bus.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { NonceModule } from './nonce/nonce.module';
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

import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response.interceptor';

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

    DomainEventBusModule,
    AuthModule,
    UserModule,
    NonceModule,
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

    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
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
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
