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
import { InventoryService } from './inventory-items.service'; 
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create inventory item (ADMIN/OWNER/MANAGER)' })
  create(@Body() createInventoryItemDto: CreateInventoryItemDto) {
    return this.inventoryService.create(createInventoryItemDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get all inventory items' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findAll(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.inventoryService.findAll(restaurantId);
  }

  @Get('category/:category')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get inventory items by category' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findByCategory(
    @Param('category') category: string,
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    return this.inventoryService.findByCategory(restaurantId, category);
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get low stock items (quantity <= reorder level)' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findLowStock(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.inventoryService.findLowStock(restaurantId);
  }

  @Get('out-of-stock')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get out of stock items (quantity = 0)' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findOutOfStock(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.inventoryService.findOutOfStock(restaurantId);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get inventory statistics' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  getStatistics(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.inventoryService.getInventoryStatistics(restaurantId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get inventory item by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update inventory item' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInventoryItemDto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.update(id, updateInventoryItemDto);
  }

  @Patch(':id/adjust')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Adjust stock quantity (add/subtract/set)' })
  adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() adjustDto: AdjustStockDto,
  ) {
    return this.inventoryService.adjustStock(id, adjustDto);
  }

  @Post('bulk-adjust')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Bulk adjust multiple items' })
  bulkAdjust(@Body() adjustments: any[]) {
    return this.inventoryService.bulkAdjustStock(adjustments);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete inventory item' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.remove(id);
  }
}