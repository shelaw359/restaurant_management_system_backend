import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
import { PaymentService } from './payments.service'; 
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, PaymentStatus } from '../common/enums';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Create payment record' })
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Post('process/:orderId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Process payment (creates payment and completes order)' })
  processPayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() processDto: ProcessPaymentDto,
  ) {
    return this.paymentService.processPayment(orderId, processDto);
  }

  // ✅ FIXED: Added WAITER role
  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Get all payments (ADMIN/OWNER/MANAGER/WAITER)' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findAll(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.paymentService.findAll(restaurantId);
  }

  // ✅ FIXED: Added WAITER role
  @Get('status/:status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Get payments by status' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findByStatus(
    @Param('status') status: PaymentStatus,
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    return this.paymentService.findByStatus(restaurantId, status);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get payment by order ID' })
  findByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.paymentService.findByOrder(orderId);
  }

  // ✅ FIXED: Added WAITER role
  @Get('revenue/daily')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Get daily revenue report' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  @ApiQuery({ name: 'date', type: String, required: false })
  getDailyRevenue(
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
    @Query('date') date?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    return this.paymentService.getDailyRevenue(restaurantId, targetDate);
  }

  // ✅ FIXED: Added WAITER role
  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Get payment statistics' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  getStatistics(
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.paymentService.getPaymentStatistics(
      restaurantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update payment (ADMIN/OWNER/MANAGER)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentService.update(id, updatePaymentDto);
  }

  @Post(':id/refund')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Refund payment (ADMIN/OWNER only)' })
  @ApiQuery({ name: 'notes', type: String, required: false })
  refund(@Param('id', ParseIntPipe) id: number, @Query('notes') notes?: string) {
    return this.paymentService.refund(id, notes);
  }
}