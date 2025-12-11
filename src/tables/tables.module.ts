import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableService } from './tables.service';
import { TableController } from './tables.controller';
import { Table } from './entities/table.entity';
import { OrderModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Table]),
    forwardRef(() => OrderModule), // ← CRITICAL: Prevents circular dependency
  ],
  controllers: [TableController],
  providers: [TableService],
  exports: [TableService], // ← CRITICAL: OrderService needs this
})
export class TableModule {}