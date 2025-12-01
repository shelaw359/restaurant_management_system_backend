// src/entities/restaurant.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity'; 
import { Table } from '../../tables/entities/table.entity'; 
import { Order } from '../../orders/entities/order.entity';
import { Customer } from '../../customers/entities/customer.entity';

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  openingTime: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  closingTime: string;

  @Column({ type: 'varchar', length: 50, default: 'Africa/Nairobi' })
  timezone: string;

  @Column({ type: 'bit', default: true })
  isActive: boolean;

  // ✅ ADD THESE RELATIONSHIPS:
  @OneToMany(() => User, (user) => user.restaurant)
  users: User[];

  @OneToMany(() => Category, (category) => category.restaurant)
  categories: Category[];

  @OneToMany(() => Table, (table) => table.restaurant)
  tables: Table[];

  @OneToMany(() => Order, (order) => order.restaurant)
  orders: Order[];

 @OneToMany(() => Customer, (customer) => customer.restaurant)
 customers: Customer[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
