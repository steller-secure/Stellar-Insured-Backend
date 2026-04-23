import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { ReputationModule } from './reputation/reputation.module';
import { DatabaseModule } from './database.module';
import { IndexerModule } from './indexer/indexer.module';
import { NotificationModule } from './notification/notification.module';
import { GovernanceModule } from './governance/governance.module';
import { InsuranceModule } from './insurance/insurance.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { StorageModule } from './storage/storage.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    EventEmitterModule.forRoot(),
    ReputationModule,
    DatabaseModule,
    IndexerModule,
    NotificationModule,
    GovernanceModule,
    InsuranceModule,

    AuditModule,
  
    AuthModule,
    UserModule,
    AnalyticsModule,
    StorageModule,

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.get<number>('THROTTLE_DEFAULT_TTL') || 900000,
          limit: config.get<number>('THROTTLE_DEFAULT_LIMIT') || 100,
        },
        {
          name: 'auth',
          ttl: config.get<number>('THROTTLE_AUTH_TTL') || 900000,
          limit: config.get<number>('THROTTLE_AUTH_LIMIT') || 5,
        },
        {
          name: 'public',
          ttl: config.get<number>('THROTTLE_PUBLIC_TTL') || 60000,
          limit: config.get<number>('THROTTLE_PUBLIC_LIMIT') || 50,
        },
        {
          name: 'admin',
          ttl: config.get<number>('THROTTLE_ADMIN_TTL') || 60000,
          limit: config.get<number>('THROTTLE_ADMIN_LIMIT') || 100,
        },
        {
          name: 'claims',
          ttl: config.get<number>('THROTTLE_CLAIMS_TTL') || 3600000,
          limit: config.get<number>('THROTTLE_CLAIMS_LIMIT') || 10,
        },
      ],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
