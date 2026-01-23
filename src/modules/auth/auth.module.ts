import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../../config/config.module';
import { AppConfigService } from '../../config/app-config.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WalletService } from './services/wallet.service';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
    CacheModule.register(),
    
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: AppConfigService) => ({
        secret: configService.jwtSecret,
        signOptions: { expiresIn: configService.jwtExpiresIn as any },
      }),
      inject: [AppConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, WalletService],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}
