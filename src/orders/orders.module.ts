// src/orders/orders.module.ts - ADD PaymentModule
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from '../order-items/entities/order-item.entity';
import { CustomerModule } from '../customers/customers.module';
import { MenuModule } from '../menu-items/menu-items.module';
import { TableModule } from '../tables/tables.module';
import { PaymentModule } from '../payments/payments.module'; // ✅ ADD THIS

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    CustomerModule,
    MenuModule,
    forwardRef(() => TableModule),
    PaymentModule, // ✅ ADD THIS
  ],
  controllers: [OrdersController],
  providers: [OrderService],
  exports: [OrderService, TypeOrmModule],
})
export class OrderModule {}