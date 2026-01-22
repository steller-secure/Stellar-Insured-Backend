import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationReadStatusDto } from './dto/update-notification-read-status.dto';
import { PaginationDto } from './dto/pagination.dto';
import { Notification } from './notification.entity';
import { OwnershipGuard } from '../../common/guards/ownership.guard';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
    type: Notification,
  })
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return await this.notificationService.create(createNotificationDto);
  }

  @UseGuards(OwnershipGuard)
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all notifications for a user with pagination' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    schema: {
      example: {
        notifications: [
          {
            id: 'uuid-here',
            userId: 'user-uuid',
            type: 'claim',
            title: 'Claim Update',
            message: 'Your claim has been processed',
            metadata: {},
            isRead: false,
            createdAt: '2026-01-22T00:00:00.000Z',
            updatedAt: '2026-01-22T00:00:00.000Z',
          },
        ],
        totalCount: 1,
      },
    },
  })
  async findAllByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return await this.notificationService.findAllByUserId(
      userId,
      paginationDto,
    );
  }

  @UseGuards(OwnershipGuard)
  @Get(':id/user/:userId')
  @ApiOperation({ summary: 'Get a specific notification by ID for a user' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification details',
    type: Notification,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async findOne(
    @Param('id') id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return await this.notificationService.findOne(id, userId);
  }

  @UseGuards(OwnershipGuard)
  @Patch(':id/read/user/:userId')
  @ApiOperation({ summary: 'Mark notification as read/unread' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification read status updated',
    type: Notification,
  })
  async updateReadStatus(
    @Param('id') id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateDto: UpdateNotificationReadStatusDto,
  ) {
    return await this.notificationService.updateReadStatus(
      id,
      userId,
      updateDto,
    );
  }

  @UseGuards(OwnershipGuard)
  @Patch(':id/mark-as-read/user/:userId')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: Notification,
  })
  async markAsRead(
    @Param('id') id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return await this.notificationService.markAsRead(id, userId);
  }

  @UseGuards(OwnershipGuard)
  @Patch(':id/mark-as-unread/user/:userId')
  @ApiOperation({ summary: 'Mark notification as unread' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as unread',
    type: Notification,
  })
  async markAsUnread(
    @Param('id') id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return await this.notificationService.markAsUnread(id, userId);
  }

  @UseGuards(OwnershipGuard)
  @Patch('mark-all-as-read/user/:userId')
  @ApiOperation({ summary: 'Mark all notifications as read for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    schema: {
      example: {
        affected: 5,
      },
    },
  })
  async markAllAsRead(@Param('userId', ParseUUIDPipe) userId: string) {
    const affected = await this.notificationService.markAllAsRead(userId);
    return { affected };
  }

  @UseGuards(OwnershipGuard)
  @Get('unread-count/user/:userId')
  @ApiOperation({ summary: 'Get unread notification count for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Unread notification count',
    schema: {
      example: {
        count: 3,
      },
    },
  })
  async getUnreadCount(@Param('userId', ParseUUIDPipe) userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @UseGuards(OwnershipGuard)
  @Delete(':id/user/:userId')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 204,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async delete(
    @Param('id') id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.notificationService.delete(id, userId);
    return { message: 'Notification deleted successfully' };
  }
}
