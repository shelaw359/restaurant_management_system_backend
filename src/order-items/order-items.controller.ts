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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrderItemService } from './order-items.service'; 
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Order Items')
@Controller('order-items')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrderItemController {
  constructor(private readonly orderItemService: OrderItemService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Add item to existing order' })
  create(@Body() createOrderItemDto: CreateOrderItemDto) {
    return this.orderItemService.create(createOrderItemDto);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get all items for an order' })
  findAll(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderItemService.findAll(orderId);
  }

  @Get('menu-item/:menuItemId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get order history for a menu item' })
  getByMenuItem(@Param('menuItemId', ParseIntPipe) menuItemId: number) {
    return this.orderItemService.getItemsByMenuItem(menuItemId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order item by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.orderItemService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Update order item (quantity or instructions)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderItemDto: UpdateOrderItemDto,
  ) {
    return this.orderItemService.update(id, updateOrderItemDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Remove item from order' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.orderItemService.remove(id);
  }
}