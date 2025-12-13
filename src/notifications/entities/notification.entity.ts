import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum NotificationType {
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  RESERVATION = 'RESERVATION',
  INVENTORY = 'INVENTORY',
  TABLE = 'TABLE',
  SYSTEM = 'SYSTEM',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'restaurant_id' })
  restaurantId: number;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: NotificationType;

  @Column({
    type: 'varchar',
    length: 50,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @Column({ type: 'nvarchar', length: 255 })
  title: string;

  @Column({ type: 'nvarchar', length: 'MAX' })
  message: string;

  @Column({ default: false })
  read: boolean;

  @Column({ type: 'nvarchar', length: 255, nullable: true })
  actionUrl?: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  metadata?: string;  // Made optional with ?

  @CreateDateColumn()
  createdAt: Date;
}