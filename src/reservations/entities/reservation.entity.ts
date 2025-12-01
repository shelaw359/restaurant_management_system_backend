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
import { Table } from '../../tables/entities/table.entity';
import { ReservationStatus } from '../../common/enums';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  restaurantId: number;

  @Column({ type: 'int' })
  tableId: number;

  @Column({ type: 'varchar', length: 255 })
  customerName: string;

  @Column({ type: 'varchar', length: 20 })
  customerPhone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerEmail: string;

  @Column({ type: 'date' })
  reservationDate: Date;

  @Column({ type: 'time' })
  reservationTime: string;

  @Column({ type: 'int' })
  guestsCount: number;

  @Column({ type: 'int', default: 2 })
  duration: number; // Duration in hours

  @Column({
    type: 'varchar',
    length: 50,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'bit', default: true })
  isActive: boolean;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.reservations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @ManyToOne(() => Table, (table) => table.reservations)
  @JoinColumn({ name: 'tableId' })
  table: Table;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}