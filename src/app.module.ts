import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module'; 
import { RestaurantModule } from './restaurants/restaurants.module'; 
import { CategoryModule } from './categories/categories.module'; 
import { MenuModule } from './menu-items/menu-items.module'; 
import { TableModule } from './tables/tables.module';
import { OrderModule } from './orders/orders.module';
import { OrderItemModule } from './order-items/order-items.module';
import { PaymentsModule } from './payments/payments.module';
import { ReservationsModule } from './reservations/reservations.module';
import { InventoryItemsModule } from './inventory-items/inventory-items.module';
import { CustomerModule } from './customers/customers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(),
    AuthModule,
    RestaurantModule,
    CategoryModule,
    MenuModule,
    TableModule,
    OrderModule,
    OrderItemModule,
    PaymentsModule,
    ReservationsModule,
    InventoryItemsModule,
    CustomerModule,
  ],
})
export class AppModule {}