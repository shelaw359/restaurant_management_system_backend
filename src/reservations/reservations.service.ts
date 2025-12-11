import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Reservation } from './entities/reservation.entity'; 
import { Table } from '../tables/entities/table.entity'
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { ReservationStatus, TableStatus } from '../common/enums';

@Injectable()
export class ReservationService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
  ) {}

  async create(createReservationDto: CreateReservationDto): Promise<Reservation> {
    // 1. Check if table exists
    const table = await this.tableRepository.findOne({
      where: { id: createReservationDto.tableId },
    });

    if (!table) {
      throw new NotFoundException(`Table #${createReservationDto.tableId} not found`);
    }

    // 2. Check table capacity
    if (createReservationDto.guestsCount > table.capacity) {
      throw new BadRequestException(
        `Table capacity (${table.capacity}) is less than guests count (${createReservationDto.guestsCount})`,
      );
    }

    // 3. Check for conflicting reservations
    const hasConflict = await this.checkTimeConflict(
      createReservationDto.tableId,
      createReservationDto.reservationDate,
      createReservationDto.reservationTime,
      createReservationDto.duration || 2,
    );

    if (hasConflict) {
      throw new ConflictException('Table is already reserved for this time slot');
    }

    // 4. Create reservation
    const reservation = this.reservationRepository.create({
      ...createReservationDto,
      duration: createReservationDto.duration || 2,
      status: ReservationStatus.PENDING,
    });

    return await this.reservationRepository.save(reservation);
  }

  async findAll(restaurantId: number): Promise<Reservation[]> {
    return await this.reservationRepository.find({
      where: { restaurantId, isActive: true },
      relations: ['table'],
      order: { reservationDate: 'DESC', reservationTime: 'DESC' },
    });
  }

  async findByDate(restaurantId: number, date: string): Promise<Reservation[]> {
    return await this.reservationRepository.find({
      where: {
        restaurantId,
        reservationDate: new Date(date) as any,
        isActive: true,
      },
      relations: ['table'],
      order: { reservationTime: 'ASC' },
    });
  }

  async findByStatus(
    restaurantId: number,
    status: ReservationStatus,
  ): Promise<Reservation[]> {
    return await this.reservationRepository.find({
      where: { restaurantId, status, isActive: true },
      relations: ['table'],
      order: { reservationDate: 'DESC', reservationTime: 'DESC' },
    });
  }

  async findUpcoming(restaurantId: number): Promise<Reservation[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await this.reservationRepository.find({
      where: {
        restaurantId,
        status: ReservationStatus.CONFIRMED,
        isActive: true,
      },
      relations: ['table'],
      order: { reservationDate: 'ASC', reservationTime: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ['restaurant', 'table'],
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation #${id} not found`);
    }

    return reservation;
  }

  async update(
    id: number,
    updateReservationDto: UpdateReservationDto,
  ): Promise<Reservation> {
    const reservation = await this.findOne(id);

    if (reservation.status === ReservationStatus.COMPLETED) {
      throw new BadRequestException('Cannot update completed reservation');
    }

    // Check for conflicts if date/time/table changed
    if (
      updateReservationDto.tableId ||
      updateReservationDto.reservationDate ||
      updateReservationDto.reservationTime ||
      updateReservationDto.duration
    ) {
      const tableId = updateReservationDto.tableId || reservation.tableId;
      const date =
        updateReservationDto.reservationDate || reservation.reservationDate.toISOString();
      const time = updateReservationDto.reservationTime || reservation.reservationTime;
      const duration = updateReservationDto.duration || reservation.duration;

      const hasConflict = await this.checkTimeConflict(
        tableId,
        date,
        time,
        duration,
        id,
      );

      if (hasConflict) {
        throw new ConflictException('Table is already reserved for this time slot');
      }
    }

    Object.assign(reservation, updateReservationDto);
    await this.reservationRepository.save(reservation);

    return await this.findOne(id);
  }

  /**
   * ✅ FIXED: Now properly handles SEATED status
   * Table status flow:
   * PENDING → No table status change
   * CONFIRMED → Table = RESERVED
   * SEATED → Table = OCCUPIED (customer is sitting)
   * COMPLETED/CANCELLED/NO_SHOW → Table = AVAILABLE
   */
  async updateStatus(id: number, status: ReservationStatus): Promise<Reservation> {
    const reservation = await this.findOne(id);
    const oldStatus = reservation.status;

    // Update reservation status
    reservation.status = status;

    // Get the table to update its status
    const table = await this.tableRepository.findOne({
      where: { id: reservation.tableId },
    });

    if (!table) {
      throw new NotFoundException(`Table #${reservation.tableId} not found`);
    }

    // Handle table status updates based on reservation status changes
    switch (status) {
      case ReservationStatus.CONFIRMED:
        // When confirmed, mark table as RESERVED
        if (table.status !== TableStatus.OCCUPIED) {
          table.status = TableStatus.RESERVED;
          await this.tableRepository.save(table);
        }
        break;

      case ReservationStatus.SEATED:
        // ✅ CRITICAL: When customer is seated, mark table as OCCUPIED
        table.status = TableStatus.OCCUPIED;
        await this.tableRepository.save(table);
        break;

      case ReservationStatus.COMPLETED:
      case ReservationStatus.CANCELLED:
      case ReservationStatus.NO_SHOW:
        // When reservation ends, free the table
        // Only free if it was previously reserved or occupied
        if (
          table.status === TableStatus.RESERVED || 
          table.status === TableStatus.OCCUPIED
        ) {
          table.status = TableStatus.AVAILABLE;
          await this.tableRepository.save(table);
        }
        break;

      case ReservationStatus.PENDING:
        // No table status change for pending
        break;
    }

    // Save reservation with new status
    await this.reservationRepository.save(reservation);
    
    // Return updated reservation with relations
    return await this.findOne(id);
  }

  async cancel(id: number): Promise<Reservation> {
    return await this.updateStatus(id, ReservationStatus.CANCELLED);
  }

  async checkAvailability(dto: CheckAvailabilityDto): Promise<{
    available: boolean;
    availableTables: Table[];
  }> {
    // Get all tables with sufficient capacity
    const tables = await this.tableRepository.find({
      where: {
        restaurantId: dto.restaurantId,
        isActive: true,
      },
    });

    const suitableTables = tables.filter((table) => table.capacity >= dto.guestsCount);

    // Check which tables are available
    const availableTables: Table[] = [];

    for (const table of suitableTables) {
      const hasConflict = await this.checkTimeConflict(
        table.id,
        dto.date,
        dto.time,
        dto.duration,
      );

      if (!hasConflict) {
        availableTables.push(table);
      }
    }

    return {
      available: availableTables.length > 0,
      availableTables,
    };
  }

  private async checkTimeConflict(
    tableId: number,
    date: string | Date,
    time: string,
    duration: number,
    excludeReservationId?: number,
  ): Promise<boolean> {
    const reservationDate = typeof date === 'string' ? new Date(date) : date;

    // Calculate start and end times
    const [hours, minutes] = time.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration * 60;

    // Get all active reservations for this table on this date
    // Include CONFIRMED and SEATED reservations in conflict check
    const existingReservations = await this.reservationRepository.find({
      where: {
        tableId,
        reservationDate: reservationDate as any,
        isActive: true,
      },
    });

    // Filter to only check relevant statuses
    const relevantReservations = existingReservations.filter(
      (r) => 
        r.status === ReservationStatus.CONFIRMED || 
        r.status === ReservationStatus.SEATED ||
        r.status === ReservationStatus.PENDING, // Include pending too
    );

    // Check for time conflicts
    for (const existing of relevantReservations) {
      if (excludeReservationId && existing.id === excludeReservationId) {
        continue;
      }

      const [existingHours, existingMinutes] = existing.reservationTime
        .split(':')
        .map(Number);
      const existingStart = existingHours * 60 + existingMinutes;
      const existingEnd = existingStart + existing.duration * 60;

      // Check if times overlap
      if (
        (startMinutes >= existingStart && startMinutes < existingEnd) ||
        (endMinutes > existingStart && endMinutes <= existingEnd) ||
        (startMinutes <= existingStart && endMinutes >= existingEnd)
      ) {
        return true; // Conflict found
      }
    }

    return false; // No conflict
  }

  async getReservationStatistics(restaurantId: number, startDate: Date, endDate: Date) {
    const reservations = await this.reservationRepository.find({
      where: {
        restaurantId,
        isActive: true,
      },
    });

    const filteredReservations = reservations.filter((r) => {
      const resDate = new Date(r.reservationDate);
      return resDate >= startDate && resDate <= endDate;
    });

    return {
      total: filteredReservations.length,
      confirmed: filteredReservations.filter((r) => r.status === ReservationStatus.CONFIRMED)
        .length,
      pending: filteredReservations.filter((r) => r.status === ReservationStatus.PENDING)
        .length,
      seated: filteredReservations.filter((r) => r.status === ReservationStatus.SEATED)
        .length, // ✅ ADDED: Include seated count in stats
      cancelled: filteredReservations.filter((r) => r.status === ReservationStatus.CANCELLED)
        .length,
      completed: filteredReservations.filter((r) => r.status === ReservationStatus.COMPLETED)
        .length,
      noShow: filteredReservations.filter((r) => r.status === ReservationStatus.NO_SHOW)
        .length,
      totalGuests: filteredReservations.reduce((sum, r) => sum + r.guestsCount, 0),
    };
  }
}