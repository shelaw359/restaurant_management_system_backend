import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationService } from './reservations.service'; 
import { ReservationController } from './reservations.controller'; 
import { Reservation } from './entities/reservation.entity'; 
import { Table } from '../tables/entities/table.entity'; 

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Table])],
  controllers: [ReservationController],
  providers: [ReservationService],
  exports: [ReservationService],
})
export class ReservationModule {}