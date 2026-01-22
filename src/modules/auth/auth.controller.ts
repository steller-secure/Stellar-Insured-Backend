import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginChallengeDto } from './dto/login-challenge.dto';
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WalletThrottlerGuard } from '../../common/guards/wallet-throttler.guard';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(WalletThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/challenge')
  @ApiOperation({ summary: 'Request a login challenge' })
  @ApiResponse({ status: 200, description: 'Challenge generated' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  async getLoginChallenge(@Body() dto: LoginChallengeDto) {
    return this.authService.generateChallenge(dto.walletAddress);
  }

  @Post('login')
  @ApiOperation({ summary: 'Submit login signature' })
  @ApiResponse({ status: 200, description: 'Login successful, JWT issued' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 requests per hour
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.walletAddress, dto.signature);
  }
}
