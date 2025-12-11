import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { OrderItem } from './entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { OrderStatus } from '../common/enums';

@Injectable()
export class OrderItemService {
  constructor(
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
    private dataSource: DataSource,
  ) {}

  async create(createOrderItemDto: CreateOrderItemDto): Promise<OrderItem> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if order exists
      const order = await this.orderRepository.findOne({
        where: { id: createOrderItemDto.orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order #${createOrderItemDto.orderId} not found`);
      }

      // Check if order is still modifiable
      if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot add items to completed or cancelled orders');
      }

      // Check if menu item exists
      const menuItem = await this.menuItemRepository.findOne({
        where: { id: createOrderItemDto.menuItemId },
      });

      if (!menuItem) {
        throw new NotFoundException(`Menu item #${createOrderItemDto.menuItemId} not found`);
      }

      // Check if menu item is available
      if (menuItem.isAvailable !== undefined && !menuItem.isAvailable) {
        throw new BadRequestException(`${menuItem.name} is currently unavailable`);
      }

      // Calculate prices
      const unitPrice = Number(menuItem.price);
      const totalPrice = unitPrice * createOrderItemDto.quantity;

      // Create order item
      const orderItem = this.orderItemRepository.create({
        orderId: createOrderItemDto.orderId,
        menuItemId: createOrderItemDto.menuItemId,
        quantity: createOrderItemDto.quantity,
        unitPrice,
        totalPrice,
        specialInstructions: createOrderItemDto.specialInstructions,
      });

      const savedItem = await queryRunner.manager.save(orderItem);

      // Update order totals
      await this.recalculateOrderTotals(order.id, queryRunner.manager);

      await queryRunner.commitTransaction();

      // Return with relations
      const result = await this.orderItemRepository.findOne({
        where: { id: savedItem.id },
        relations: ['menuItem', 'menuItem.category', 'order'],
      });

      if (!result) {
        throw new NotFoundException('Order item not found after creation');
      }

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(orderId: number): Promise<OrderItem[]> {
    // Check if order exists first
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    return await this.orderItemRepository.find({
      where: { orderId },
      relations: ['menuItem', 'menuItem.category'],
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: number): Promise<OrderItem> {
    const orderItem = await this.orderItemRepository.findOne({
      where: { id },
      relations: ['order', 'menuItem', 'menuItem.category'],
    });

    if (!orderItem) {
      throw new NotFoundException(`Order item #${id} not found`);
    }

    return orderItem;
  }

  async update(id: number, updateOrderItemDto: UpdateOrderItemDto): Promise<OrderItem> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get order item
      const orderItem = await this.orderItemRepository.findOne({
        where: { id },
      });

      if (!orderItem) {
        throw new NotFoundException(`Order item #${id} not found`);
      }

      // Get order to check status
      const order = await this.orderRepository.findOne({
        where: { id: orderItem.orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order #${orderItem.orderId} not found`);
      }

      // Check if order is still modifiable
      if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot update items in completed or cancelled orders');
      }

      // Handle menu item change
      if (updateOrderItemDto.menuItemId && updateOrderItemDto.menuItemId !== orderItem.menuItemId) {
        const menuItem = await this.menuItemRepository.findOne({
          where: { id: updateOrderItemDto.menuItemId },
        });

        if (!menuItem) {
          throw new NotFoundException(`Menu item #${updateOrderItemDto.menuItemId} not found`);
        }

        if (menuItem.isAvailable !== undefined && !menuItem.isAvailable) {
          throw new BadRequestException(`${menuItem.name} is currently unavailable`);
        }

        orderItem.menuItemId = updateOrderItemDto.menuItemId;
        orderItem.unitPrice = Number(menuItem.price);
      }

      // Update quantity
      if (updateOrderItemDto.quantity !== undefined) {
        if (updateOrderItemDto.quantity < 1) {
          throw new BadRequestException('Quantity must be at least 1');
        }
        orderItem.quantity = updateOrderItemDto.quantity;
      }

      // Update special instructions
      if (updateOrderItemDto.specialInstructions !== undefined) {
        orderItem.specialInstructions = updateOrderItemDto.specialInstructions;
      }

      // Recalculate total price
      orderItem.totalPrice = Number(orderItem.unitPrice) * orderItem.quantity;

      const updatedItem = await queryRunner.manager.save(orderItem);

      // Recalculate order totals
      await this.recalculateOrderTotals(orderItem.orderId, queryRunner.manager);

      await queryRunner.commitTransaction();

      // Return with relations
      const result = await this.orderItemRepository.findOne({
        where: { id: updatedItem.id },
        relations: ['menuItem', 'menuItem.category', 'order'],
      });

      if (!result) {
        throw new NotFoundException('Order item not found after update');
      }

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get order item
      const orderItem = await this.orderItemRepository.findOne({
        where: { id },
      });

      if (!orderItem) {
        throw new NotFoundException(`Order item #${id} not found`);
      }

      // Get order to check status
      const order = await this.orderRepository.findOne({
        where: { id: orderItem.orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order #${orderItem.orderId} not found`);
      }

      // Check if order is still modifiable
      if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot remove items from completed or cancelled orders');
      }

      // Check if this is the last item
      const itemCount = await this.orderItemRepository.count({
        where: { orderId: orderItem.orderId },
      });

      if (itemCount <= 1) {
        throw new BadRequestException('Cannot remove the last item from an order');
      }

      // Delete the item
      await queryRunner.manager.remove(orderItem);

      // Recalculate order totals
      await this.recalculateOrderTotals(orderItem.orderId, queryRunner.manager);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getItemsByMenuItem(menuItemId: number): Promise<OrderItem[]> {
    // Check if menu item exists
    const menuItem = await this.menuItemRepository.findOne({
      where: { id: menuItemId },
    });

    if (!menuItem) {
      throw new NotFoundException(`Menu item #${menuItemId} not found`);
    }

    return await this.orderItemRepository.find({
      where: { menuItemId },
      relations: ['order', 'order.table'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async recalculateOrderTotals(
    orderId: number,
    entityManager?: EntityManager,
  ): Promise<void> {
    const manager = entityManager || this.orderRepository.manager;

    const order = await manager.findOne(Order, {
      where: { id: orderId },
      relations: ['orderItems'],
    });

    if (!order) {
      return;
    }

    // Get all order items for this order
    const orderItems = await manager.find(OrderItem, {
      where: { orderId },
    });

    // Calculate new subtotal
    const subtotal = orderItems.reduce(
      (sum, item) => sum + Number(item.totalPrice || 0),
      0,
    );

    // Update order
    order.subtotal = subtotal;
    order.total = subtotal - Number(order.discount || 0);

    await manager.save(order);
  }
}