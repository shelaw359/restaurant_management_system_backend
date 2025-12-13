import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Get all notifications for logged-in user
  @Get()
  async findAll(
    @Request() req,
    @Query('unread_only') unreadOnly?: string,
  ) {
    const userId = req.user.id;
    const restaurantId = req.user.restaurantId; // Get from JWT token
    const unread = unreadOnly === 'true';
    return await this.notificationsService.findAllByUser(userId, restaurantId, unread);
  }

  // Get unread count
  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const userId = req.user.id;
    const restaurantId = req.user.restaurantId;
    const count = await this.notificationsService.getUnreadCount(userId, restaurantId);
    return { count };
  }

  // Mark notification as read
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    const restaurantId = req.user.restaurantId;
    return await this.notificationsService.markAsRead(+id, userId, restaurantId);
  }

  // Mark all as read
  @Patch('mark-all-read')
  async markAllAsRead(@Request() req) {
    const userId = req.user.id;
    const restaurantId = req.user.restaurantId;
    await this.notificationsService.markAllAsRead(userId, restaurantId);
    return { message: 'All notifications marked as read' };
  }

  // Delete notification
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    const restaurantId = req.user.restaurantId;
    await this.notificationsService.remove(+id, userId, restaurantId);
    return { message: 'Notification deleted' };
  }

  // Create notification (internal use)
  @Post()
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return await this.notificationsService.create(createNotificationDto);
  }
}