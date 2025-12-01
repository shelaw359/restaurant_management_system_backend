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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrderService } from './orders.service'; 
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto'; 
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, OrderStatus } from '../common/enums';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Create order' })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findAll(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.orderService.findAll(restaurantId);
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get orders by status' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findByStatus(
    @Param('status') status: OrderStatus,
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    return this.orderService.findByStatus(restaurantId, status);
  }

  @Get('waiter/:waiterId')
  @ApiOperation({ summary: 'Get orders by waiter' })
  findByWaiter(@Param('waiterId', ParseIntPipe) waiterId: number) {
    return this.orderService.findByWaiter(waiterId);
  }

  @Get('table/:tableId')
  @ApiOperation({ summary: 'Get active orders for table' })
  findByTable(@Param('tableId', ParseIntPipe) tableId: number) {
    return this.orderService.findByTable(tableId);
  }

  @Get('sales/daily')
  @ApiOperation({ summary: 'Get daily sales report' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  @ApiQuery({ name: 'date', type: String, required: false })
  getDailySales(
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
    @Query('date') date?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    return this.orderService.getDailySales(restaurantId, targetDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Update order' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.orderService.update(id, updateOrderDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER, UserRole.CHEF)
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, updateStatusDto.status);
  }

  @Patch(':id/discount')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Apply discount (ADMIN/OWNER/MANAGER only)' })
  applyDiscount(
    @Param('id', ParseIntPipe) id: number,
    @Body() discountDto: ApplyDiscountDto,
  ) {
    return this.orderService.applyDiscount(id, discountDto.discount);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel order (ADMIN/OWNER/MANAGER)' })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.cancelOrder(id);
  }
}