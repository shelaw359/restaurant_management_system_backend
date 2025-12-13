import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  // Create a new notification
  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      userId: createNotificationDto.userId,
      restaurantId: createNotificationDto.restaurantId,
      type: createNotificationDto.type,
      priority: createNotificationDto.priority,
      title: createNotificationDto.title,
      message: createNotificationDto.message,
      actionUrl: createNotificationDto.actionUrl,
      metadata: createNotificationDto.metadata 
        ? JSON.stringify(createNotificationDto.metadata) 
        : undefined,  // Changed from null to undefined
    });

    return await this.notificationsRepository.save(notification);
  }

  // Get all notifications for a user in a restaurant
  async findAllByUser(userId: number, restaurantId: number, unreadOnly: boolean = false): Promise<any[]> {
    const query = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.restaurantId = :restaurantId', { restaurantId })
      .orderBy('notification.createdAt', 'DESC')
      .take(50);

    if (unreadOnly) {
      query.andWhere('notification.read = :read', { read: false });
    }

    const notifications = await query.getMany();
    
    // Parse JSON metadata for each notification
    return notifications.map(notification => ({
      ...notification,
      metadata: notification.metadata ? JSON.parse(notification.metadata) : null,
    }));
  }

  // Get unread count for a user in a restaurant
  async getUnreadCount(userId: number, restaurantId: number): Promise<number> {
    return await this.notificationsRepository.count({
      where: {
        userId: userId,
        restaurantId: restaurantId,
        read: false,
      },
    });
  }

  // Mark as read
  async markAsRead(id: number, userId: number, restaurantId: number): Promise<any> {
    const notification = await this.notificationsRepository.findOne({
      where: { id, userId, restaurantId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.read = true;
    const saved = await this.notificationsRepository.save(notification);
    
    // Parse metadata before returning
    return {
      ...saved,
      metadata: saved.metadata ? JSON.parse(saved.metadata) : null,
    };
  }

  // Mark all as read for a user in a restaurant
  async markAllAsRead(userId: number, restaurantId: number): Promise<void> {
    await this.notificationsRepository.update(
      { userId, restaurantId, read: false },
      { read: true },
    );
  }

  // Delete notification
  async remove(id: number, userId: number, restaurantId: number): Promise<void> {
    const result = await this.notificationsRepository.delete({
      id,
      userId,
      restaurantId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Notification not found');
    }
  }
}