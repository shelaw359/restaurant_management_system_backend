// src/entities/payment.entity.ts (Complete)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../../common/enums';
import { PaymentStatus } from '../../common/enums'; 
import { Order } from '../../orders/entities/order.entity'; 

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column({ type: 'int' })
  @ApiProperty()
  orderId: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  @ApiProperty()
  paymentNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty()
  amount: number;

  @Column({
    type: 'varchar',
    length: 20,
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  @ApiProperty({ enum: PaymentMethod })
  method: PaymentMethod;

  @Column({
    type: 'varchar',
    length: 20,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @ApiProperty()
  transactionId: string;

  @Column({ type: 'datetime', nullable: true })
  @ApiProperty()
  paidAt: Date;

  @Column({ type: 'text', nullable: true })
  @ApiProperty()
  paymentGatewayResponse: string;

  @CreateDateColumn()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Order, (order) => order.payments)
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
