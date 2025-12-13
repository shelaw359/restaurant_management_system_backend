import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';  // ⬅️ ADD THIS
import { AppService } from './app.service';        // ⬅️ ADD THIS
import { AuthModule } from './auth/auth.module'; 
import { RestaurantModule } from './restaurants/restaurants.module'; 
import { CategoryModule } from './categories/categories.module'; 
import { MenuModule } from './menu-items/menu-items.module'; 
import { TableModule } from './tables/tables.module';
import { OrderModule } from './orders/orders.module';
import { OrderItemModule } from './order-items/order-items.module';
import { PaymentModule } from './payments/payments.module';
import { ReservationModule } from './reservations/reservations.module';
import { InventoryModule } from './inventory-items/inventory-items.module';
import { CustomerModule } from './customers/customers.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';

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
          synchronize: isDevelopment,
          logging: isDevelopment,
          logger: 'advanced-console',
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
    InventoryModule,
    CustomerModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  controllers: [AppController],  // ⬅️ ADD THIS LINE
  providers: [AppService],       // ⬅️ ADD THIS LINE
})
export class AppModule {}
