import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from '../order-items/entities/order-item.entity';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus, OrderType, PaymentStatus, PaymentMethod } from '../common/enums';
import { Customer } from '../customers/entities/customer.entity';
import { CustomerService } from '../customers/customers.service';
import { MenuItemService } from '../menu-items/menu-items.service';
import { TableService } from '../tables/tables.service';
import { PaymentService } from '../payments/payments.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private customerService: CustomerService,
    private menuService: MenuItemService,
    @Inject(forwardRef(() => TableService))
    private tableService: TableService,
    private paymentService: PaymentService,
  ) {}

  async create(createOrderData: any): Promise<Order> {
    console.log('🚨 DEBUG: OrderService.create() called');
    console.log('🚨 DEBUG: createOrderData.waiterId:', createOrderData.waiterId);
    console.log('🚨 DEBUG: Full createOrderData:', JSON.stringify(createOrderData, null, 2));

    // Validate required fields
    if (!createOrderData.waiterId) {
      throw new BadRequestException('waiterId is required');
    }
    
    if (!createOrderData.restaurantId) {
      throw new BadRequestException('restaurantId is required');
    }

    if (!createOrderData.totalAmount && createOrderData.totalAmount !== 0) {
      throw new BadRequestException('totalAmount is required');
    }

    const {
      restaurantId,
      waiterId,
      tableId,
      customerPhone,
      customerName,
      customerCount,
      orderType,
      items,
      notes,
      totalAmount,
    } = createOrderData;

    // Validate Order Type and Table
    if (orderType === OrderType.DINE_IN) {
      if (!tableId) {
        throw new BadRequestException('Dine-in orders require a table assignment');
      }
      await this.tableService.validateTableForOrder(tableId, orderType);
      console.log(`✅ Table #${tableId} validated for DINE_IN order`);
    } else if (orderType === OrderType.TAKEAWAY) {
      if (tableId) {
        throw new BadRequestException('Takeaway orders should not have a table assignment');
      }
      console.log('✅ TAKEAWAY order - no table needed');
    }

    // Handle Customer (Find or Create)
    let customer: Customer | null = null;
    let customerId: number | null = null;
    
    if (customerPhone && customerName) {
      customer = await this.customerService.findOrCreate(restaurantId, {
        phone: customerPhone,
        name: customerName,
      });
      customerId = customer.id;
      console.log(`✅ Customer resolved: ${customer.name} (ID: ${customer.id})`);
    }

    // Generate Order Number with retry logic
    const maxRetries = 3;
    let savedOrder: Order | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Generate Order Number
        const orderNumber = await this.generateOrderNumber(restaurantId);
        console.log(`✅ Order number generated: ${orderNumber} (Attempt ${attempt + 1}/${maxRetries})`);

        // Create Order Entity - USE ALL REQUIRED FIELDS
        const orderData: any = {
          restaurantId,
          orderNumber,
          waiterId,
          customerCount: customerCount || 1,
          orderType,
          status: OrderStatus.PENDING,
          subtotal: totalAmount || 0,
          discount: 0,
          total: totalAmount || 0,
          notes: notes || '',
        };

        if (orderType === OrderType.DINE_IN && tableId) {
          orderData.tableId = tableId;
        }

        if (customerId) {
          orderData.customerId = customerId;
        }

        console.log('🚨 DEBUG: Creating order with data:', orderData);

        const order = this.orderRepository.create(orderData);
        
        const savedOrderResult = await this.orderRepository.save(order);
        savedOrder = Array.isArray(savedOrderResult) ? savedOrderResult[0] : savedOrderResult;
        
        console.log(`✅ Order created: ID ${savedOrder.id}, Number: ${savedOrder.orderNumber}`);
        console.log(`✅ waiterId in saved order: ${savedOrder.waiterId}`);
        
        // Success! Break out of retry loop
        break;
        
      } catch (error) {
        // Check if it's a duplicate key error
        if (error.code === 'EREQUEST' && error.number === 2627) {
          console.log(`🔄 Duplicate order number detected, retrying... (Attempt ${attempt + 1}/${maxRetries})`);
          
          if (attempt < maxRetries - 1) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          } else {
            // All retries exhausted
            throw new BadRequestException('Failed to generate unique order number after multiple attempts. Please try again.');
          }
        }
        
        // If it's a different error, throw immediately
        throw error;
      }
    }

    if (!savedOrder) {
      throw new BadRequestException('Failed to create order');
    }

    // Create Order Items
    if (items && items.length > 0) {
      let subtotal = 0;

      for (const item of items) {
        const menuItem = await this.menuService.findOne(item.menuItemId);
        
        if (!menuItem.isAvailable) {
          throw new BadRequestException(`Menu item "${menuItem.name}" is not available`);
        }

        // Use price from request, not from database (in case prices differ)
        const itemPrice = item.price || menuItem.price;
        const totalPrice = itemPrice * item.quantity;
        subtotal += totalPrice;

        const orderItem = this.orderItemRepository.create({
          orderId: savedOrder.id,
          menuItemId: menuItem.id,
          quantity: item.quantity,
          unitPrice: itemPrice,
          totalPrice,
          specialInstructions: item.specialInstructions || '',
        });

        await this.orderItemRepository.save(orderItem);
        console.log(`✅ Order item added: ${menuItem.name} x${item.quantity} @ $${itemPrice} = $${totalPrice}`);
      }

      // Update totals if they don't match
      if (Math.abs(subtotal - savedOrder.subtotal) > 0.01) {
        console.log(`⚠️ Adjusting totals: Calculated subtotal=${subtotal}, Saved subtotal=${savedOrder.subtotal}`);
        savedOrder.subtotal = subtotal;
        savedOrder.total = subtotal - (savedOrder.discount || 0);
        await this.orderRepository.save(savedOrder);
      }
      
      console.log(`✅ Order totals: Subtotal=${savedOrder.subtotal}, Total=${savedOrder.total}`);
    }

    // AUTO-OCCUPY TABLE (for DINE_IN only)
    if (orderType === OrderType.DINE_IN && tableId) {
      try {
        await this.tableService.autoOccupyTable(tableId, savedOrder.id);
        console.log(`✅ Table #${tableId} auto-occupied for Order #${savedOrder.id}`);
      } catch (error) {
        console.error(`❌ Failed to occupy table:`, error.message);
      }
    }

    return await this.findOne(savedOrder.id);
  }

  async updateStatus(id: number, status: OrderStatus): Promise<Order> {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(`Cannot update cancelled order`);
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
      [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [OrderStatus.SERVED, OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.SERVED]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [],
      [OrderStatus.CANCELLED]: [],
    };

    const currentStatus = order.status;
    const allowedTransitions = validTransitions[currentStatus];
    
    if (!allowedTransitions.includes(status)) {
      throw new BadRequestException(
        `Cannot transition order from ${currentStatus} to ${status}. ` +
        `Valid transitions: ${allowedTransitions.join(', ') || 'none'}`
      );
    }

    const previousStatus = order.status;
    order.status = status;

    if (status === OrderStatus.COMPLETED) {
      order.completedAt = new Date();
    }

    // ✅ CRITICAL FIX: When marking order as PAID, sync with payment
    if (status === OrderStatus.PAID) {
      try {
        // Use processPayment which handles both creation and completion
        await this.paymentService.processPayment(order.id, {
          method: PaymentMethod.CASH,
          transactionId: `AUTO-${Date.now()}`,
          notes: 'Payment processed when order marked as PAID',
        });
        console.log(`✅ Payment processed for order #${id}`);
      } catch (error) {
        console.error(`❌ Failed to process payment for order #${id}:`, error.message);
        
        // Fallback: Try to update payment if it exists
        try {
          const payment = await this.paymentService.findByOrder(id);
          if (payment && payment.status === PaymentStatus.PENDING) {
            await this.paymentService.update(payment.id, {
              status: PaymentStatus.COMPLETED,
            });
            console.log(`✅ Payment #${payment.id} updated to COMPLETED`);
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback also failed:`, fallbackError.message);
        }
      }
    }

    const updatedOrder = await this.orderRepository.save(order);
    console.log(`✅ Order #${id} status: ${previousStatus} → ${status}`);

    // AUTO-RELEASE TABLE
    if (
      (status === OrderStatus.COMPLETED || 
       status === OrderStatus.CANCELLED || 
       status === OrderStatus.PAID) &&
      order.orderType === OrderType.DINE_IN &&
      order.tableId
    ) {
      try {
        await this.tableService.autoReleaseTable(order.tableId, order.id);
        console.log(`✅ Table #${order.tableId} checked for auto-release`);
      } catch (error) {
        console.error(`⚠️ Failed to auto-release table:`, error.message);
      }
    }

    return updatedOrder;
  }

  private async generateOrderNumber(restaurantId: number): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    
    const latestOrder = await this.orderRepository
      .createQueryBuilder('order')
      .select(['order.orderNumber'])
      .where('order.restaurantId = :restaurantId', { restaurantId })
      .andWhere('order.orderNumber LIKE :pattern', { pattern: `ORD-${dateStr}-%` })
      .orderBy('order.orderNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (latestOrder?.orderNumber) {
      const match = latestOrder.orderNumber.match(/ORD-\d{8}-(\d{4})$/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    const orderNumber = `ORD-${dateStr}-${sequence.toString().padStart(4, '0')}`;
    
    console.log('🔢 Order number generation:', {
      date: dateStr,
      latestOrderNumber: latestOrder?.orderNumber,
      nextSequence: sequence,
      generatedOrderNumber: orderNumber
    });
    
    return orderNumber;
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: [
        'orderItems',
        'orderItems.menuItem',
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

  async findAll(restaurantId: number, filters?: any): Promise<Order[]> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.menuItem', 'menuItem')
      .leftJoinAndSelect('order.table', 'table')
      .leftJoinAndSelect('order.waiter', 'waiter')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.payment', 'payment')
      .where('order.restaurantId = :restaurantId', { restaurantId });

    if (filters?.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters?.orderType) {
      query.andWhere('order.orderType = :orderType', { orderType: filters.orderType });
    }

    if (filters?.tableId) {
      query.andWhere('order.tableId = :tableId', { tableId: filters.tableId });
    }

    if (filters?.waiterId) {
      query.andWhere('order.waiterId = :waiterId', { waiterId: filters.waiterId });
    }

    return await query
      .orderBy('order.createdAt', 'DESC')
      .getMany();
  }

  async findByTable(tableId: number): Promise<Order[]> {
    return await this.orderRepository.find({
      where: [
        { tableId, status: OrderStatus.PENDING },
        { tableId, status: OrderStatus.CONFIRMED },
        { tableId, status: OrderStatus.IN_PROGRESS },
      ],
      relations: ['orderItems', 'orderItems.menuItem', 'waiter', 'customer', 'payment'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        `Cannot update ${order.status.toLowerCase()} order`
      );
    }

    Object.assign(order, updateOrderDto);
    
    if ('discount' in updateOrderDto && updateOrderDto.discount !== undefined) {
      const discountValue = Number(updateOrderDto.discount) || 0;
      order.total = Number(order.subtotal) - discountValue;
    }

    return await this.orderRepository.save(order);
  }

  async remove(id: number): Promise<void> {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot delete completed orders');
    }

    if (order.orderType === OrderType.DINE_IN && order.tableId) {
      try {
        await this.tableService.autoReleaseTable(order.tableId, order.id);
      } catch (error) {
        console.error(`⚠️ Failed to release table on order deletion:`, error.message);
      }
    }

    await this.orderRepository.remove(order);
  }

  async getDailySales(restaurantId: number, date?: Date) {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const orders = await this.orderRepository.find({
      where: {
        restaurantId,
        status: OrderStatus.PAID,
        createdAt: Between(targetDate, nextDay),
      },
    });

    const summary = {
      date: targetDate.toISOString().slice(0, 10),
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0),
      dineInOrders: orders.filter(o => o.orderType === OrderType.DINE_IN).length,
      takeawayOrders: orders.filter(o => o.orderType === OrderType.TAKEAWAY).length,
      averageOrderValue: orders.length > 0 
        ? orders.reduce((sum, o) => sum + Number(o.total), 0) / orders.length 
        : 0,
    };

    return summary;
  }
}