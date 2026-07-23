import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import { NotificationService } from './services/notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { DomainEventBus } from '../common/events/domain-event-bus.service';
import { DomainEventName } from '../common/events/event-types';
import { Prisma } from '@prisma/client';

@ApiTags('Notifications')
@ApiBearerAuth()
@SkipThrottle({ auth: true })
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly notificationService: NotificationService,
    private readonly eventBus: DomainEventBus,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('notify')
  @HttpCode(202)
  @ApiOperation({
    summary:
      'Queue a notification for delivery (email + web push) via background jobs',
  })
  @ApiBody({ type: CreateNotificationDto })
  @ApiOkResponse({
    description: 'Notification accepted and queued for delivery',
  })
  async notify(@Body() dto: CreateNotificationDto) {
    await this.notificationService.notify(
      dto.userId,
      dto.type,
      dto.title,
      dto.message,
      dto.data as Prisma.InputJsonValue | undefined,
    );
    return { accepted: true };
  }

  @Throttle({ default: {} })
  @Get('settings/:userId')
  @ApiOperation({ summary: 'Fetch notification settings for a user' })
  @ApiParam({ name: 'userId', type: String, description: 'ID of the user' })
  @ApiOkResponse({ description: 'Notification settings for the user' })
  async getSettings(@Param('userId') userId: string) {
    await this.ensureActiveUser(userId);

    return this.prisma.notificationSetting.upsert({
      where: { userId },
      update: { deletedAt: null },
      create: { userId },
    });
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Put('settings/:userId')
  @ApiOperation({ summary: 'Update notification preferences for a user' })
  @ApiParam({ name: 'userId', type: String, description: 'ID of the user' })
  @ApiBody({ type: UpdateNotificationSettingsDto })
  @ApiOkResponse({ description: 'Updated notification settings' })
  async updateSettings(
    @Param('userId') userId: string,
    @Body() settings: UpdateNotificationSettingsDto,
  ) {
    await this.ensureActiveUser(userId);

    const result = await this.prisma.notificationSetting.upsert({
      where: { userId },
      update: { ...settings, deletedAt: null },
      create: {
        userId,
        ...settings,
      },
    });

    await this.eventBus.emit(DomainEventName.NOTIFICATION_SETTING_UPDATED, {
      userId,
      settings,
      reason: 'Notification settings updated',
    });

    return result;
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('subscribe/:userId')
  @ApiOperation({ summary: 'Subscribe a user to push notifications' })
  @ApiParam({
    name: 'userId',
    type: String,
    description: 'ID of the subscribing user',
  })
  @ApiBody({ type: PushSubscriptionDto })
  @ApiOkResponse({ description: 'Subscription created successfully' })
  async subscribeToPush(
    @Param('userId') userId: string,
    @Body() subscription: PushSubscriptionDto,
  ) {
    if (
      !subscription.endpoint ||
      !subscription.keys ||
      !subscription.keys.p256dh ||
      !subscription.keys.auth
    ) {
      throw new BadRequestException('Invalid push subscription format');
    }

    try {
      new URL(subscription.endpoint);
    } catch {
      throw new BadRequestException('Invalid endpoint URL');
    }

    try {
      const p256dh = Buffer.from(subscription.keys.p256dh, 'base64');
      const auth = Buffer.from(subscription.keys.auth, 'base64');

      if (p256dh.length === 0 || auth.length === 0) {
        throw new BadRequestException('Invalid key format');
      }
    } catch {
      throw new BadRequestException('Invalid key encoding');
    }

    await this.ensureActiveUser(userId);

    const encryptedSubscription = this.encryption.encrypt(
      JSON.stringify(subscription),
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { pushSubscription: encryptedSubscription },
    });
    return { success: true };
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }
}
