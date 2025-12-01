import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module'; 
import { RestaurantModule } from './restaurants/restaurants.module'; 
import { CategoryModule } from './categories/categories.module'; 
import { MenuModule } from './menu-items/menu-items.module'; 
import { TableModule } from './tables/tables.module';
import { OrderModule } from './orders/orders.module';
import { OrderItemModule } from './order-items/order-items.module';
import { PaymentModule } from './payments/payments.module';
import { ReservationModule } from './reservations/reservations.module';
import { InventoryItemsModule } from './inventory-items/inventory-items.module';
import { CustomerModule } from './customers/customers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isDevelopment = configService.get('NODE_ENV') === 'development';
        
        return {
          type: 'mssql',
          host: configService.get('DB_HOST'),
          port: +configService.get('DB_PORT'),
          username: configService.get('DB_USERNAME'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_NAME'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: isDevelopment, // Auto-create tables in dev
          logging: isDevelopment, // Show SQL logs in dev
          logger: 'advanced-console', // Better logs
          options: {
            encrypt: false,
            trustServerCertificate: true,
          },
          extra: {
            trustServerCertificate: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    RestaurantModule,
    CategoryModule,
    MenuModule,
    TableModule,
    OrderModule,
    OrderItemModule,
    PaymentModule,
    ReservationModule,
    InventoryItemsModule,
    CustomerModule,
  ],
})
export class AppModule {}