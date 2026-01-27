import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
// import { redisStore } from 'cache-manager-redis-yet';
import { ConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { DatabaseModule } from './common/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { PolicyModule } from './modules/policy/policy.module';
import { DaoModule } from './modules/dao/dao.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FileModule } from './modules/file/file.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { QueueModule } from './modules/queue/queue.module';
import { AuditLogModule } from './common/audit-log/audit-log.module';
import { AuditModule } from './modules/audit/audit.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { FilesController } from './modules/files/files.controller';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule,
    HealthModule,
    
    // TEMPORARY: In-memory cache
    CacheModule.register({
      isGlobal: true,
    }),
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.throttleDefaultTtl,
            limit: configService.throttleDefaultLimit,
          },
          {
            name: 'auth',
            ttl: configService.throttleAuthTtl,
            limit: configService.throttleAuthLimit,
          },
          {
            name: 'public',
            ttl: configService.throttlePublicTtl,
            limit: configService.throttlePublicLimit,
          },
          {
            name: 'admin',
            ttl: configService.throttleAdminTtl,
            limit: configService.throttleAdminLimit,
          },
        ],
      }),
      inject: [AppConfigService],
    }),
    HealthModule,
    ClaimsModule,
    PolicyModule,
    DaoModule,
    NotificationModule,
    UsersModule,
    AuthModule,
    AnalyticsModule,
    FileModule,
    PaymentsModule,
    QueueModule,
    AuditLogModule,
    DashboardModule,
  ],
  controllers: [AppController, FilesController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    }
  ],
})
export class AppModule {}