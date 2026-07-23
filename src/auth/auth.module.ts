import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('JWT_SECRET');

        // Guard: env.validation.ts already checks this at startup, but we add
        // a second check here so AuthModule fails loudly if somehow bypassed
        // (e.g. in unit tests that skip global validation).
        if (!secret || secret.trim().length < 32) {
          throw new Error(
            'JWT_SECRET is missing or too short. ' +
              'Set a strong secret (≥32 chars) in your .env file. ' +
              'Generate one with: openssl rand -base64 48',
          );
        }

        const expiresIn = configService.get<string>(
          'JWT_ACCESS_TOKEN_TTL',
          '15m',
        ) as StringValue;

        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  providers: [JwtStrategy],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
