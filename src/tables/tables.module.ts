import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TableService } from './tables.service'; 
import { TableController } from './tables.controller'; 
import { Table } from './entities/table.entity'; 

@Module({
  imports: [TypeOrmModule.forFeature([Table])],
  controllers: [TableController],
  providers: [TableService],
  exports: [TableService],
})
export class TableModule {}