import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemService } from './order-items.service';
import { OrderItemController } from './order-items.controller';
import { OrderItem } from './entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';
@Module({
  imports: [TypeOrmModule.forFeature([OrderItem, Order, MenuItem])],
  controllers: [OrderItemController],
  providers: [OrderItemService],
  exports: [OrderItemService],
})
export class OrderItemModule {}
