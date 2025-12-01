import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity'; 
import { OrderItem } from '../../order-items/entities/order-item.entity'; 

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  categoryId: number;

  @Column({ type: 'int' })
  restaurantId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'bit', default: true })
  isAvailable: boolean;

  @Column({ type: 'int', nullable: true })
  prepTime: number;

  @Column({ type: 'bit', default: false })
  isPopular: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @ManyToOne(() => Category, (category) => category.menuItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

@OneToMany(() => OrderItem, (orderItem) => orderItem.menuItem)
 orderItems: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
