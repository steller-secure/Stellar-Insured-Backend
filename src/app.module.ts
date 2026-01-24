import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { FilesController } from './modules/files/files.controller';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule,
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
    AuditModule,
  ],
  controllers: [AppController, FilesController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
