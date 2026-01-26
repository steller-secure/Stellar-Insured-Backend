import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from '../../config/app-config.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WalletService } from './services/wallet.service';
import { PermissionService } from 'src/permissions/permission.service';
import { PermissionGuard } from 'src/permissions/permission.guard';

// 🔹 New imports for permissions


@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    NestConfigModule,
    CacheModule.register(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    JwtModule.registerAsync({
      imports: [NestConfigModule],
      useFactory: (configService: AppConfigService) => ({
        secret: configService.jwtSecret,
        signOptions: { expiresIn: configService.jwtExpiresIn as any },
      }),
      inject: [AppConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    WalletService,

    // 🔹 Add permission service and guard here
    PermissionService,
    PermissionGuard,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtStrategy,
    PassportModule,

    // 🔹 Export PermissionService so it can be injected in other modules if needed
    PermissionService,
  ],
})
export class AuthModule {}
