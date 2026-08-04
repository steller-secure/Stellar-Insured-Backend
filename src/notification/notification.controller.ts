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
    Version,
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
import { UserIdParamDto } from '../common/dto/user-id-param.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import { NotificationService } from './services/notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { AuditService } from '../insurance/services/audit.service';
import { AuditAction } from '../insurance/enums/audit-action.enum';
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
        private readonly auditService: AuditService,
    ) { }

    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @Version('1')
    @Post('notify')
    @HttpCode(202)
    @ApiOperation({
        summary:
            'Queue a notification for delivery (email + web push) via background jobs',
    })
    @ApiBody({ type: CreateNotificationDto })
    @ApiOkResponse({ description: 'Notification accepted and queued for delivery' })
    async notify(@Body() dto: CreateNotificationDto) {
        // Enqueue and return 202 immediately. The actual SendGrid / web-push
        // call happens off-request in the queue worker, so a slow or failing
        // provider can never block or 500 this endpoint.
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
    @Version('1')
    @Get('settings/:userId')
    @ApiOperation({ summary: 'Fetch notification settings for a user' })
    @ApiParam({ name: 'userId', type: String, description: 'ID of the user' })
    @ApiOkResponse({ description: 'Notification settings for the user' })
    async getSettings(@Param() params: UserIdParamDto) {
        const userId = params.userId;
        await this.ensureActiveUser(userId);

        return this.prisma.notificationSetting.upsert({
            where: { userId },
            // upsert bypasses the soft-delete middleware, so restore the row
            // explicitly: an active user must always see usable settings even
            // if they were previously soft-deleted (e.g. restored account).
            update: { deletedAt: null },
            create: { userId },
        });
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Version('1')
    @Put('settings/:userId')
    @ApiOperation({ summary: 'Update notification preferences for a user' })
    @ApiParam({ name: 'userId', type: String, description: 'ID of the user' })
    @ApiBody({ type: UpdateNotificationSettingsDto })
    @ApiOkResponse({ description: 'Updated notification settings' })
    async updateSettings(
        @Param() params: UserIdParamDto,
        @Body() settings: UpdateNotificationSettingsDto,
    ) {
        const userId = params.userId;
        await this.ensureActiveUser(userId);

        const result = await this.prisma.notificationSetting.upsert({
            where: { userId },
            update: { ...settings, deletedAt: null },
            create: {
                userId,
                ...settings,
            },
        });

        // Audit the settings change
        await this.auditService.log(AuditAction.UPDATE, 'NotificationSetting', userId, undefined, settings, undefined, 'Notification settings updated');

        return result;
    }

    @Throttle({ default: { limit: 3, ttl: 60000 } })
    @Version('1')
    @Post('subscribe/:userId')
    @ApiOperation({ summary: 'Subscribe a user to push notifications' })
    @ApiParam({ name: 'userId', type: String, description: 'ID of the subscribing user' })
    @ApiBody({ type: PushSubscriptionDto })
    @ApiOkResponse({ description: 'Subscription created successfully' })
    async subscribeToPush(
        @Param() params: UserIdParamDto,
        @Body() subscription: PushSubscriptionDto,
    ) {
        const userId = params.userId;
        // Validate subscription structure
        if (!subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
            throw new BadRequestException('Invalid push subscription format');
        }

        // Additional validation for endpoint URL
        try {
            new URL(subscription.endpoint);
        } catch {
            throw new BadRequestException('Invalid endpoint URL');
        }

        // Validate key formats (base64)
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

        // Encrypt push subscription before storing
        const encryptedSubscription = this.encryption.encrypt(JSON.stringify(subscription));
        await this.prisma.user.update({
            where: { id: userId },
            data: { pushSubscription: encryptedSubscription },
        });
        return { success: true };
    }

    /**
     * Rejects requests targeting missing or soft-deleted users with a 404
     * instead of silently operating on (or resurrecting) their records.
     */
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

