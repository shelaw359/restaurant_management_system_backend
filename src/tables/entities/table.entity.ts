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
import { Restaurant } from '../../restaurants/entities/restaurant.entity'; 
import { TableStatus } from '../../common/enums';
import { Order } from '../../orders/entities/order.entity'; 
import { Reservation } from '../../reservations/entities/reservation.entity';


@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  restaurantId: number;

  @Column({ type: 'varchar', length: 50 })
  tableNumber: string;

  @Column({ type: 'int' })
  capacity: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: TableStatus.AVAILABLE,
  })
  status: TableStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string;

  @Column({ type: 'bit', default: true })
  isActive: boolean;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.tables, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @OneToMany(() => Order, (order) => order.table)
  orders: Order[];

   @OneToMany(() => Reservation, reservation => reservation.table)
   reservations: Reservation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
