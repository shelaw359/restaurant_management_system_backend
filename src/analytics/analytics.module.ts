// src/analytics/analytics.module.ts (CORRECTED)
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Order } from '../orders/entities/order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';
import { OrderItem } from '../order-items/entities/order-item.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { InventoryItem } from '../inventory-items/entities/inventory-item.entity';
import { Customer } from '../customers/entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order, 
      Payment, 
      MenuItem, 
      OrderItem,
      Reservation,
      InventoryItem,
      Customer
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}