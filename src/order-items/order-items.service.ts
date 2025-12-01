import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async create(createOrderItemDto: CreateOrderItemDto): Promise<OrderItem> {
    // 1. Check if order exists
    const order = await this.orderRepository.findOne({
      where: { id: createOrderItemDto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order #${createOrderItemDto.orderId} not found`);
    }

    // 2. Check if order is still modifiable
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot add items to completed or cancelled orders');
    }

    // 3. Check if menu item exists and is available
    const menuItem = await this.menuItemRepository.findOne({
      where: { id: createOrderItemDto.menuItemId },
    });

    if (!menuItem) {
      throw new NotFoundException(`Menu item #${createOrderItemDto.menuItemId} not found`);
    }

    if (!menuItem.isAvailable) {
      throw new BadRequestException(`${menuItem.name} is currently unavailable`);
    }

    // 4. Calculate prices
    const unitPrice = Number(menuItem.price);
    const totalPrice = unitPrice * createOrderItemDto.quantity;

    // 5. Create order item
    const orderItem = this.orderItemRepository.create({
      orderId: createOrderItemDto.orderId,
      menuItemId: createOrderItemDto.menuItemId,
      quantity: createOrderItemDto.quantity,
      unitPrice,
      totalPrice,
      specialInstructions: createOrderItemDto.specialInstructions,
    });

    const savedItem = await this.orderItemRepository.save(orderItem);

    // 6. Update order totals
    await this.recalculateOrderTotals(order.id);

    return await this.findOne(savedItem.id);
  }

  async findAll(orderId: number): Promise<OrderItem[]> {
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
    const orderItem = await this.findOne(id);

    // Check if order is still modifiable
    if (
      orderItem.order.status === OrderStatus.COMPLETED ||
      orderItem.order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot update items in completed or cancelled orders');
    }

    // Update quantity if provided
    if (updateOrderItemDto.quantity) {
      orderItem.quantity = updateOrderItemDto.quantity;
      orderItem.totalPrice = Number(orderItem.unitPrice) * updateOrderItemDto.quantity;
    }

    // Update special instructions if provided
    if (updateOrderItemDto.specialInstructions !== undefined) {
      orderItem.specialInstructions = updateOrderItemDto.specialInstructions;
    }

    const updatedItem = await this.orderItemRepository.save(orderItem);

    // Recalculate order totals
    await this.recalculateOrderTotals(orderItem.orderId);

    return await this.findOne(updatedItem.id);
  }

  async remove(id: number): Promise<void> {
    const orderItem = await this.findOne(id);

    // Check if order is still modifiable
    if (
      orderItem.order.status === OrderStatus.COMPLETED ||
      orderItem.order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot remove items from completed or cancelled orders');
    }

    // Check if this is the last item
    const itemCount = await this.orderItemRepository.count({
      where: { orderId: orderItem.orderId },
    });

    if (itemCount <= 1) {
      throw new BadRequestException('Cannot remove the last item from an order');
    }

    await this.orderItemRepository.remove(orderItem);

    // Recalculate order totals
    await this.recalculateOrderTotals(orderItem.orderId);
  }

  async getItemsByMenuItem(menuItemId: number): Promise<OrderItem[]> {
    return await this.orderItemRepository.find({
      where: { menuItemId },
      relations: ['order', 'order.table'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async recalculateOrderTotals(orderId: number): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['orderItems'],
    });

    if (!order) {
      return;
    }

    // Calculate new subtotal
    const subtotal = order.orderItems.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0,
    );

    // Update order
    order.subtotal = subtotal;
    order.total = subtotal - Number(order.discount);

    await this.orderRepository.save(order);
  }
}