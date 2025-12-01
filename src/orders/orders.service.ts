import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from '../order-items/entities/order-item.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus, TableStatus } from '../common/enums';
import { CustomerService } from '../customers/customers.service';
import { TableService } from '../tables/tables.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
    private customerService: CustomerService,
    private tableService: TableService,
    private dataSource: DataSource,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Handle customer (find or create)
      let customerId: number | undefined;
      if (createOrderDto.customerPhone) {
        const customer = await this.customerService.findOrCreate({
          phone: createOrderDto.customerPhone,
          restaurantId: createOrderDto.restaurantId,
          name: createOrderDto.customerName,
        });
        customerId = customer.id;
      }

      // 2. Create order
      const order = this.orderRepository.create({
        restaurantId: createOrderDto.restaurantId,
        orderNumber: await this.generateOrderNumber(createOrderDto.restaurantId),
        tableId: createOrderDto.tableId,
        waiterId: createOrderDto.waiterId,
        customerId,
        customerCount: createOrderDto.customerCount,
        orderType: createOrderDto.orderType,
        notes: createOrderDto.notes,
        status: OrderStatus.PENDING,
        subtotal: 0,
        discount: 0,
        total: 0,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // 3. Create order items and calculate totals
      const orderItems = await this.createOrderItems(
        savedOrder.id,
        createOrderDto.items,
        queryRunner,
      );

      const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

      // 4. Update order totals
      savedOrder.subtotal = subtotal;
      savedOrder.total = subtotal;
      await queryRunner.manager.save(savedOrder);

      // 5. Occupy table if dine-in
      if (createOrderDto.tableId) {
        await this.tableService.occupyTable(createOrderDto.tableId);
      }

      await queryRunner.commitTransaction();

      // Return complete order with relations
      return await this.findOne(savedOrder.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(restaurantId: number): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { restaurantId },
      relations: ['orderItems', 'orderItems.menuItem', 'table', 'waiter', 'customer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(restaurantId: number, status: OrderStatus): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { restaurantId, status },
      relations: ['orderItems', 'orderItems.menuItem', 'table', 'waiter'],
      order: { createdAt: 'ASC' },
    });
  }

  async findByWaiter(waiterId: number): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { waiterId },
      relations: ['orderItems', 'orderItems.menuItem', 'table'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByTable(tableId: number): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { tableId, status: OrderStatus.PENDING },
      relations: ['orderItems', 'orderItems.menuItem'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: [
        'orderItems',
        'orderItems.menuItem',
        'orderItems.menuItem.category',
        'table',
        'waiter',
        'customer',
        'payment',
      ],
    });

    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    return order;
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update completed or cancelled orders');
    }

    Object.assign(order, updateOrderDto);
    await this.orderRepository.save(order);

    return await this.findOne(id);
  }

  async updateStatus(id: number, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(id);

    // Validate status transition
    if (order.status === OrderStatus.COMPLETED && status !== OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot change status of completed order');
    }

    order.status = status;

    if (status === OrderStatus.COMPLETED) {
      order.completedAt = new Date();

      // Update customer statistics
      if (order.customerId) {
        await this.customerService.updateStats(order.customerId, Number(order.total));
      }

      // Release table
      if (order.tableId) {
        await this.tableService.releaseTable(order.tableId);
      }
    }

    await this.orderRepository.save(order);
    return await this.findOne(id);
  }

  async applyDiscount(id: number, discount: number): Promise<Order> {
    const order = await this.findOne(id);

    if (discount < 0 || discount > order.subtotal) {
      throw new BadRequestException('Invalid discount amount');
    }

    order.discount = discount;
    order.total = Number(order.subtotal) - Number(discount);

    await this.orderRepository.save(order);
    return await this.findOne(id);
  }

  async cancelOrder(id: number): Promise<Order> {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed order');
    }

    order.status = OrderStatus.CANCELLED;

    // Release table if occupied
    if (order.tableId && order.table?.status === TableStatus.OCCUPIED) {
      await this.tableService.releaseTable(order.tableId);
    }

    await this.orderRepository.save(order);
    return await this.findOne(id);
  }

  async getDailySales(restaurantId: number, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await this.orderRepository.find({
      where: {
        restaurantId,
        status: OrderStatus.COMPLETED,
      },
    });

    const dailyOrders = orders.filter(
      (order) => order.createdAt >= startOfDay && order.createdAt <= endOfDay,
    );

    const totalSales = dailyOrders.reduce((sum, order) => sum + Number(order.total), 0);

    return {
      date: date.toISOString().split('T')[0],
      totalOrders: dailyOrders.length,
      totalSales,
      averageOrderValue: dailyOrders.length > 0 ? totalSales / dailyOrders.length : 0,
    };
  }

  // Private helper methods
  private async createOrderItems(
    orderId: number,
    items: any[],
    queryRunner: any,
  ): Promise<OrderItem[]> {
    const orderItems: OrderItem[] = [];

    for (const itemDto of items) {
      const menuItem = await this.menuItemRepository.findOne({
        where: { id: itemDto.menuItemId },
      });

      if (!menuItem) {
        throw new NotFoundException(`Menu item #${itemDto.menuItemId} not found`);
      }

      if (!menuItem.isAvailable) {
        throw new BadRequestException(`${menuItem.name} is currently unavailable`);
      }

      const totalPrice = Number(menuItem.price) * itemDto.quantity;

      const orderItem = this.orderItemRepository.create({
        order: { id: orderId } as Order,
        menuItem: { id: menuItem.id } as MenuItem,
        quantity: itemDto.quantity,
        unitPrice: menuItem.price,
        totalPrice,
        specialInstructions: itemDto.specialInstructions,
      });

      const savedItem = await queryRunner.manager.save(orderItem);
      orderItems.push(savedItem);
    }

    return orderItems;
  }

  private async generateOrderNumber(restaurantId: number): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    
    // Get count of orders today for this restaurant to ensure uniqueness
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const todayOrdersCount = await this.orderRepository.count({
      where: {
        restaurantId,
      },
    });
    
    const sequence = (todayOrdersCount + 1).toString().padStart(4, '0');
    return `ORD-${dateStr}-${sequence}`;
  }
}