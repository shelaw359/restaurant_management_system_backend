import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './orders.service'; 
import { OrderController } from './orders.controller';
import { Order } from './entities/order.entity'; 
import { OrderItem } from '../order-items/entities/order-item.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';
import { CustomerModule } from '../customers/customers.module';
import { TableModule } from 'src/tables/tables.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, MenuItem]),
    CustomerModule,
    TableModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}