import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  restaurantId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', length: 50 })
  unit: string; // kg, liters, pieces, etc.

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  reorderLevel: number; // Minimum quantity before reorder

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentValue: number; // quantity × unit cost

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string; // Food, Beverage, Cleaning, Other

  @Column({ type: 'bit', default: true })
  isActive: boolean;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.inventoryItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}