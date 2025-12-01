import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from './entities/table.entity';  
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TableStatus } from '../common/enums';

@Injectable()
export class TableService {
  constructor(
    @InjectRepository(Table)
    private tableRepository: Repository<Table>,
  ) {}

  async create(createTableDto: CreateTableDto): Promise<Table> {
    // Check for duplicate table number in same restaurant
    const existing = await this.tableRepository.findOne({
      where: {
        tableNumber: createTableDto.tableNumber,
        restaurantId: createTableDto.restaurantId,
      },
    });

    if (existing) {
      throw new ConflictException('Table number already exists in this restaurant');
    }

    const table = this.tableRepository.create({
      ...createTableDto,
      status: createTableDto.status || TableStatus.AVAILABLE,
    });

    return await this.tableRepository.save(table);
  }

  async findAll(restaurantId: number): Promise<Table[]> {
    return await this.tableRepository.find({
      where: { restaurantId, isActive: true },
      order: { tableNumber: 'ASC' },
    });
  }

  async findByStatus(restaurantId: number, status: TableStatus): Promise<Table[]> {
    return await this.tableRepository.find({
      where: { restaurantId, status, isActive: true },
      order: { tableNumber: 'ASC' },
    });
  }

  async findAvailableTables(restaurantId: number, capacity?: number): Promise<Table[]> {
    const query = this.tableRepository
      .createQueryBuilder('table')
      .where('table.restaurantId = :restaurantId', { restaurantId })
      .andWhere('table.status = :status', { status: TableStatus.AVAILABLE })
      .andWhere('table.isActive = :isActive', { isActive: true });

    if (capacity) {
      query.andWhere('table.capacity >= :capacity', { capacity });
    }

    return await query.orderBy('table.capacity', 'ASC').getMany();
  }

  async findOne(id: number): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id },
      relations: ['restaurant'],
    });

    if (!table) {
      throw new NotFoundException(`Table #${id} not found`);
    }

    return table;
  }

  async update(id: number, updateTableDto: UpdateTableDto): Promise<Table> {
    const table = await this.findOne(id);

    // Check for duplicate table number if changing
    if (updateTableDto.tableNumber && updateTableDto.tableNumber !== table.tableNumber) {
      const existing = await this.tableRepository.findOne({
        where: {
          tableNumber: updateTableDto.tableNumber,
          restaurantId: table.restaurantId,
        },
      });

      if (existing) {
        throw new ConflictException('Table number already exists');
      }
    }

    Object.assign(table, updateTableDto);
    return await this.tableRepository.save(table);
  }

  async updateStatus(id: number, status: TableStatus): Promise<Table> {
    const table = await this.findOne(id);

    // Validate status transition
    if (table.status === TableStatus.OCCUPIED && status === TableStatus.RESERVED) {
      throw new BadRequestException('Cannot reserve an occupied table');
    }

    table.status = status;
    return await this.tableRepository.save(table);
  }

  async occupyTable(id: number): Promise<Table> {
    const table = await this.findOne(id);

    if (table.status !== TableStatus.AVAILABLE) {
      throw new BadRequestException(
        `Table is currently ${table.status}. Only available tables can be occupied.`,
      );
    }

    table.status = TableStatus.OCCUPIED;
    return await this.tableRepository.save(table);
  }

  async releaseTable(id: number): Promise<Table> {
    const table = await this.findOne(id);

    if (table.status !== TableStatus.OCCUPIED) {
      throw new BadRequestException('Only occupied tables can be released');
    }

    table.status = TableStatus.AVAILABLE;
    return await this.tableRepository.save(table);
  }

  async remove(id: number): Promise<void> {
    const table = await this.findOne(id);

    if (table.status === TableStatus.OCCUPIED) {
      throw new BadRequestException('Cannot delete an occupied table');
    }

    table.isActive = false;
    await this.tableRepository.save(table);
  }

  async getTableStatistics(restaurantId: number) {
    const tables = await this.findAll(restaurantId);

    const stats = {
      total: tables.length,
      available: tables.filter((t) => t.status === TableStatus.AVAILABLE).length,
      occupied: tables.filter((t) => t.status === TableStatus.OCCUPIED).length,
      reserved: tables.filter((t) => t.status === TableStatus.RESERVED).length,
      totalCapacity: tables.reduce((sum, t) => sum + t.capacity, 0),
      availableCapacity: tables
        .filter((t) => t.status === TableStatus.AVAILABLE)
        .reduce((sum, t) => sum + t.capacity, 0),
    };

    return stats;
  }
}