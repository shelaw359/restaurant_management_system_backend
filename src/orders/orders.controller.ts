import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrderService } from './orders.service';
import { PaymentService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, OrderStatus, OrderType, PaymentMethod } from '../common/enums';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  // ============================================
  // CREATE ORDER - Universal Endpoint
  // ============================================
  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ 
    summary: 'Create new order (DINE_IN or TAKEAWAY)',
    description: `
      - DINE_IN orders: tableId is REQUIRED (will auto-occupy table)
      - TAKEAWAY orders: tableId must be NULL
      - Table will be auto-occupied when order is created (DINE_IN only)
      - Table will be auto-released when order is completed/cancelled (DINE_IN only)
    `
  })
  async create(
    @CurrentUser() user: any,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    console.log('🚨 DEBUG: OrderController.create() called');
    console.log('🚨 DEBUG: User object from JWT:', user);
    console.log('🚨 DEBUG: waiterId from request body:', createOrderDto.waiterId);

    // Determine waiterId correctly
    let waiterId = createOrderDto.waiterId;
    
    if (!waiterId) {
      waiterId = user?.id;
      
      if (!waiterId) {
        waiterId = user?.sub;
      }
      
      if (!waiterId) {
        console.error('❌ NO waiterId found!');
        console.error('User object:', user);
        throw new BadRequestException('waiterId is required. Provide in request or ensure user has id in JWT.');
      }
      
      console.log('✅ Using waiterId from JWT:', waiterId);
    } else {
      console.log('✅ Using waiterId from request body:', waiterId);
    }

    // Determine restaurantId correctly
    let restaurantId = user?.restaurantId;
    
    if (!restaurantId && createOrderDto.restaurantId) {
      restaurantId = createOrderDto.restaurantId;
      console.log('✅ Using restaurantId from request body:', restaurantId);
    }
    
    if (!restaurantId) {
      throw new BadRequestException('restaurantId is required. Ensure user has restaurantId in JWT or provide in request.');
    }
    
    console.log('✅ Final values:', { waiterId, restaurantId });

    // Validate order type and table
    if (createOrderDto.orderType === OrderType.DINE_IN && !createOrderDto.tableId) {
      throw new BadRequestException('DINE_IN orders require a tableId');
    }

    if (createOrderDto.orderType === OrderType.TAKEAWAY && createOrderDto.tableId) {
      throw new BadRequestException('TAKEAWAY orders should not have a tableId');
    }

    // Pass to service with CORRECT waiterId
    return await this.orderService.create({
      ...createOrderDto,
      waiterId: waiterId,
      restaurantId: restaurantId,
    });
  }

  // ============================================
  // CONVENIENCE: Create Dine-In Order
  // ============================================
  @Post('dine-in')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ 
    summary: 'Quick create dine-in order',
    description: 'Shortcut for creating dine-in orders - automatically sets orderType and validates table'
  })
  async createDineIn(
    @CurrentUser() user: any,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    console.log('🚨 DEBUG: createDineIn() called');
    
    let waiterId = createOrderDto.waiterId || user?.id || user?.sub;
    
    if (!waiterId) {
      throw new BadRequestException('waiterId is required');
    }

    if (!createOrderDto.tableId) {
      throw new BadRequestException('tableId is required for dine-in orders');
    }

    const restaurantId = user?.restaurantId || createOrderDto.restaurantId;
    
    if (!restaurantId) {
      throw new BadRequestException('restaurantId is required');
    }

    return await this.orderService.create({
      ...createOrderDto,
      orderType: OrderType.DINE_IN,
      waiterId: waiterId,
      restaurantId: restaurantId,
    });
  }

  // ============================================
  // CONVENIENCE: Create Takeaway Order
  // ============================================
  @Post('takeaway')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ 
    summary: 'Quick create takeaway order',
    description: 'Shortcut for creating takeaway orders - automatically sets orderType and ignores table'
  })
  async createTakeaway(
    @CurrentUser() user: any,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    console.log('🚨 DEBUG: createTakeaway() called');
    
    let waiterId = createOrderDto.waiterId || user?.id || user?.sub;
    
    if (!waiterId) {
      throw new BadRequestException('waiterId is required');
    }

    const { tableId, ...orderData } = createOrderDto;

    const restaurantId = user?.restaurantId || orderData.restaurantId;
    
    if (!restaurantId) {
      throw new BadRequestException('restaurantId is required');
    }

    return await this.orderService.create({
      ...orderData,
      orderType: OrderType.TAKEAWAY,
      tableId: null,
      waiterId: waiterId,
      restaurantId: restaurantId,
    });
  }

  // ============================================
  // PROCESS PAYMENT - FIXED VERSION
  // ============================================
  @Post(':id/pay')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ 
    summary: 'Process payment for order',
    description: 'Mark order as PAID and create payment record'
  })
  async processPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() paymentData: { 
      paymentMethod: string; 
      amount: number;
      transactionId?: string;
      notes?: string;
    }
  ) {
    const order = await this.orderService.findOne(id);
    
    // Validate order can be paid
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot process payment for cancelled order');
    }
    
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Order is already paid');
    }
    
    // Validate amount
    if (Math.abs(paymentData.amount - order.total) > 0.01) {
      throw new BadRequestException(
        `Payment amount (${paymentData.amount}) does not match order total (${order.total})`
      );
    }
    
    // Convert string to PaymentMethod enum
    const methodString = paymentData.paymentMethod.toUpperCase();
    let paymentMethodEnum: PaymentMethod;
    
    // Check if the string matches a PaymentMethod enum value
    if (Object.values(PaymentMethod).includes(methodString as PaymentMethod)) {
      paymentMethodEnum = methodString as PaymentMethod;
    } else {
      // If not exact match, try to map common variations
      const methodMap: Record<string, PaymentMethod> = {
        'CASH': PaymentMethod.CASH,
        'CARD': PaymentMethod.CARD,
        'CREDIT_CARD': PaymentMethod.CARD,
        'DEBIT_CARD': PaymentMethod.CARD,
        'MOBILE': PaymentMethod.MPESA,
        'MOBILE_MONEY': PaymentMethod.MPESA,
        'MPESA': PaymentMethod.MPESA,
        'BANK_TRANSFER': PaymentMethod.BANK_TRANSFER,
        'BANK': PaymentMethod.BANK_TRANSFER,
        'TRANSFER': PaymentMethod.BANK_TRANSFER,
      };
      
      paymentMethodEnum = methodMap[methodString] || PaymentMethod.CASH;
    }
    
    // CREATE PAYMENT RECORD USING PaymentService
    const payment = await this.paymentService.processPayment(id, {
      method: paymentMethodEnum,
      transactionId: paymentData.transactionId,
      notes: paymentData.notes,
    });
    
    console.log('✅ Payment record created:', payment.id);
    
    // THEN UPDATE ORDER STATUS TO PAID
    const paidOrder = await this.orderService.updateStatus(id, OrderStatus.PAID);
    
    console.log('✅ Order marked as PAID:', paidOrder.id);
    
    return {
      message: 'Payment processed successfully',
      order: paidOrder,
      payment: payment,
    };
  }

  // ============================================
  // GET ALL ORDERS
  // ============================================
  @Get()
  @ApiOperation({ summary: 'Get all orders for restaurant' })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiQuery({ name: 'orderType', enum: OrderType, required: false })
  @ApiQuery({ name: 'tableId', type: Number, required: false })
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: OrderStatus,
    @Query('orderType') orderType?: OrderType,
    @Query('tableId', new ParseIntPipe({ optional: true })) tableId?: number,
  ) {
    const restaurantId = user?.restaurantId;
    
    if (!restaurantId) {
      throw new BadRequestException('restaurantId not found for user');
    }

    return await this.orderService.findAll(restaurantId, {
      status,
      orderType,
      tableId,
    });
  }

  // ============================================
  // GET ACTIVE ORDERS (Dashboard View)
  // ============================================
  @Get('active')
  @ApiOperation({ 
    summary: 'Get all active orders (PENDING, CONFIRMED, IN_PROGRESS)',
    description: 'Used for kitchen displays and waiter dashboards'
  })
  async findActive(@CurrentUser() user: any) {
    const restaurantId = user?.restaurantId;
    
    if (!restaurantId) {
      throw new BadRequestException('restaurantId not found for user');
    }

    const pending = await this.orderService.findAll(restaurantId, { 
      status: OrderStatus.PENDING 
    });
    const confirmed = await this.orderService.findAll(restaurantId, { 
      status: OrderStatus.CONFIRMED 
    });
    const inProgress = await this.orderService.findAll(restaurantId, { 
      status: OrderStatus.IN_PROGRESS 
    });

    return {
      pending,
      confirmed,
      inProgress,
      total: pending.length + confirmed.length + inProgress.length,
    };
  }

  // ============================================
  // GET ORDERS BY STATUS (Kitchen Display)
  // ============================================
  @Get('status/:status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER, UserRole.CHEF)
  @ApiOperation({ 
    summary: 'Get orders by status (for Kitchen Display)',
    description: 'Used by Kitchen page to filter orders by PENDING, IN_PROGRESS, COMPLETED'
  })
  async findByStatus(
    @CurrentUser() user: any,
    @Param('status') status: OrderStatus,
  ) {
    const restaurantId = user?.restaurantId;
    
    if (!restaurantId) {
      throw new BadRequestException('restaurantId not found for user');
    }

    return await this.orderService.findAll(restaurantId, { status });
  }

  // ============================================
  // GET ORDERS BY TABLE
  // ============================================
  @Get('table/:tableId')
  @ApiOperation({ summary: 'Get all active orders for a specific table' })
  async findByTable(@Param('tableId', ParseIntPipe) tableId: number) {
    return await this.orderService.findByTable(tableId);
  }

  // ============================================
  // GET ORDERS BY WAITER
  // ============================================
  @Get('waiter/:waiterId')
  @ApiOperation({ summary: 'Get orders assigned to a specific waiter' })
  async findByWaiter(
    @CurrentUser() user: any,
    @Param('waiterId', ParseIntPipe) waiterId: number,
  ) {
    const restaurantId = user?.restaurantId;
    
    if (!restaurantId) {
      throw new BadRequestException('restaurantId not found for user');
    }

    return await this.orderService.findAll(restaurantId, { waiterId });
  }

  // ============================================
  // GET SINGLE ORDER
  // ============================================
  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID with full details' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.orderService.findOne(id);
  }

  // ============================================
  // UPDATE ORDER STATUS
  // ============================================
  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER, UserRole.CHEF)
  @ApiOperation({ 
    summary: 'Update order status',
    description: `
      - Setting to COMPLETED or CANCELLED will auto-release table (if DINE_IN)
      - Only releases table if no other active orders on same table
    `
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return await this.orderService.updateStatus(id, updateStatusDto.status);
  }

  // ============================================
  // UPDATE ORDER
  // ============================================
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Update order details' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return await this.orderService.update(id, updateOrderDto);
  }

  // ============================================
  // DELETE ORDER
  // ============================================
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ 
    summary: 'Delete order (ADMIN/OWNER/MANAGER only)',
    description: 'Will auto-release table if DINE_IN order'
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.orderService.remove(id);
    return { message: 'Order deleted successfully' };
  }

  // ============================================
  // SALES SUMMARY
  // ============================================
  @Get('sales/daily')
  @ApiOperation({ summary: 'Get daily sales summary' })
  @ApiQuery({ name: 'date', required: false, example: '2024-12-06' })
  async getDailySales(
    @CurrentUser() user: any,
    @Query('date') dateStr?: string,
  ) {
    const restaurantId = user?.restaurantId;
    
    if (!restaurantId) {
      throw new BadRequestException('restaurantId not found for user');
    }

    const date = dateStr ? new Date(dateStr) : new Date();
    return await this.orderService.getDailySales(restaurantId, date);
  }

  // ============================================
  // ORDER SUMMARY (for dashboard)
  // ============================================
  @Get('summary/today')
  @ApiOperation({ summary: 'Get today\'s order summary' })
  async getTodaySummary(@CurrentUser() user: any) {
    const restaurantId = user?.restaurantId;
    
    if (!restaurantId) {
      throw new BadRequestException('restaurantId not found for user');
    }

    const today = await this.orderService.getDailySales(restaurantId);
    const active = await this.findActive(user);

    return {
      today,
      active: {
        total: active.total,
        pending: active.pending.length,
        confirmed: active.confirmed.length,
        inProgress: active.inProgress.length,
      },
    };
  }
}