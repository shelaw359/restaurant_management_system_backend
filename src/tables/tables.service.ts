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
import { TableStatus, OrderType } from '../common/enums';

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
      isActive: true,
    });

    return await this.tableRepository.save(table);
  }

  async findAll(restaurantId: number, includeInactive = false): Promise<Table[]> {
    const where: any = { restaurantId };
    
    if (!includeInactive) {
      where.isActive = true;
    }

    return await this.tableRepository.find({
      where,
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

  async findTablesWithOrders(restaurantId: number): Promise<Table[]> {
    return await this.tableRepository.find({
      where: { restaurantId, isActive: true },
      relations: ['orders', 'orders.orderItems', 'orders.orderItems.menuItem'],
      order: { tableNumber: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id },
      relations: ['restaurant', 'orders', 'orders.orderItems'],
    });

    if (!table) {
      throw new NotFoundException(`Table #${id} not found`);
    }

    return table;
  }

  async findOneWithActiveOrders(id: number): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id },
      relations: ['orders', 'orders.orderItems'],
    });

    if (!table) {
      throw new NotFoundException(`Table #${id} not found`);
    }

    // Filter only active orders (not completed or cancelled)
    if (table.orders) {
      table.orders = table.orders.filter(
        order => !['COMPLETED', 'CANCELLED'].includes(order.status)
      );
    }

    return table;
  }

  async update(id: number, updateTableDto: UpdateTableDto): Promise<Table> {
    const table = await this.findOne(id);

    // Prevent updating occupied table's number/location
    if (table.status === TableStatus.OCCUPIED) {
      throw new BadRequestException('Cannot update an occupied table. Release it first.');
    }

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

  // ============================================
  // NEW: AUTO-OCCUPY TABLE (Called by OrderService)
  // ============================================
  async autoOccupyTable(tableId: number, orderId: number): Promise<Table> {
    const table = await this.findOne(tableId);

    // Only occupy if table is AVAILABLE or RESERVED
    if (table.status === TableStatus.AVAILABLE || table.status === TableStatus.RESERVED) {
      table.status = TableStatus.OCCUPIED;
      const updatedTable = await this.tableRepository.save(table);
      
      console.log(`✅ Table #${table.tableNumber} auto-occupied by Order #${orderId}`);
      return updatedTable;
    }

    // If already occupied, just return it (multiple orders scenario)
    if (table.status === TableStatus.OCCUPIED) {
      console.log(`⚠️ Table #${table.tableNumber} already occupied, allowing order`);
      return table;
    }

    throw new BadRequestException(
      `Cannot occupy table #${table.tableNumber} - current status: ${table.status}`
    );
  }

  // ============================================
  // NEW: AUTO-RELEASE TABLE (Called when last order completes)
  // ============================================
  async autoReleaseTable(tableId: number, orderId: number): Promise<Table> {
    const table = await this.findOneWithActiveOrders(tableId);

    // Check if this table still has OTHER active orders
    const otherActiveOrders = table.orders.filter(
      order => order.id !== orderId && !['COMPLETED', 'CANCELLED'].includes(order.status)
    );

    if (otherActiveOrders.length === 0) {
      // No more active orders, release the table
      table.status = TableStatus.AVAILABLE;
      const updatedTable = await this.tableRepository.save(table);
      
      console.log(`✅ Table #${table.tableNumber} auto-released (no active orders)`);
      return updatedTable;
    } else {
      console.log(`⚠️ Table #${table.tableNumber} still has ${otherActiveOrders.length} active order(s)`);
      return table;
    }
  }

  // ============================================
  // MANUAL OCCUPY (For walk-ins without order yet)
  // ============================================
  async occupyTable(id: number): Promise<Table> {
    const table = await this.findOne(id);

    if (table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.RESERVED) {
      throw new BadRequestException(
        `Table is currently ${table.status}. Only available/reserved tables can be manually occupied.`,
      );
    }

    table.status = TableStatus.OCCUPIED;
    return await this.tableRepository.save(table);
  }

  // ============================================
  // MANUAL RELEASE (For cleanup or corrections)
  // ============================================
  async releaseTable(id: number): Promise<Table> {
    const table = await this.findOneWithActiveOrders(id);

    if (table.status !== TableStatus.OCCUPIED) {
      throw new BadRequestException('Only occupied tables can be released');
    }

    // Check if table has active orders before releasing
    if (table.orders && table.orders.length > 0) {
      const hasActiveOrders = table.orders.some(
        order => !['COMPLETED', 'CANCELLED'].includes(order.status)
      );
      
      if (hasActiveOrders) {
        throw new BadRequestException(
          'Table has active orders. Complete or cancel orders first.'
        );
      }
    }

    table.status = TableStatus.AVAILABLE;
    return await this.tableRepository.save(table);
  }

  async remove(id: number): Promise<void> {
    const table = await this.findOne(id);

    if (table.status === TableStatus.OCCUPIED || table.status === TableStatus.RESERVED) {
      throw new BadRequestException(
        `Cannot delete a ${table.status.toLowerCase()} table`
      );
    }

    // Soft delete if has historical orders
    const tableWithOrders = await this.tableRepository.findOne({
      where: { id },
      relations: ['orders'],
    });

    // Around line 264:
     if (tableWithOrders?.orders && tableWithOrders.orders.length > 0) {
      table.isActive = false;
      await this.tableRepository.save(table);
    } else {
      await this.tableRepository.delete(id);
    }
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
      occupancyRate: tables.length > 0 
        ? Math.round((tables.filter((t) => t.status === TableStatus.OCCUPIED).length / tables.length) * 100) 
        : 0,
    };

    return stats;
  }

  // ============================================
  // VALIDATION: For OrderService to check before creating order
  // ============================================
  async validateTableForOrder(tableId: number, orderType: OrderType): Promise<Table> {
    const table = await this.findOne(tableId);
    
    if (orderType === OrderType.DINE_IN) {
      // For DINE_IN: table must be available or reserved
      if (table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.RESERVED) {
        throw new BadRequestException(
          `Table #${table.tableNumber} is currently ${table.status}. ` +
          `Please select an available table for dine-in orders.`
        );
      }
      
      if (!table.isActive) {
        throw new BadRequestException(`Table #${table.tableNumber} is not active`);
      }
    }
    
    return table;
  }

  // ============================================
  // NEW: SUGGEST TABLES (For party size)
  // ============================================
  async suggestTablesForParty(
    restaurantId: number, 
    partySize: number
  ): Promise<Table[]> {
    // Find available tables that can fit the party
    const suitableTables = await this.tableRepository
      .createQueryBuilder('table')
      .where('table.restaurantId = :restaurantId', { restaurantId })
      .andWhere('table.status = :status', { status: TableStatus.AVAILABLE })
      .andWhere('table.isActive = :isActive', { isActive: true })
      .andWhere('table.capacity >= :partySize', { partySize })
      .orderBy('table.capacity', 'ASC') // Smallest fitting table first
      .limit(5) // Top 5 suggestions
      .getMany();

    return suitableTables;
  }
}