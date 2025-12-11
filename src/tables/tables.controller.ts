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
import { TableService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, TableStatus } from '../common/enums';
// ADD THESE IMPORTS:
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Tables')
@Controller('tables')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create table (ADMIN/OWNER/MANAGER)' })
  create(
    @CurrentUser() user: User, // ADDED
    @Body() createTableDto: CreateTableDto,
  ) {
    // Auto-inject restaurantId from JWT
    return this.tableService.create({
      ...createTableDto,
      restaurantId: user.restaurantId, // AUTO from JWT
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all tables for a restaurant' })
  @ApiQuery({ name: 'restaurantId', type: Number, required: false }) // Made optional
  findAll(
    @CurrentUser() user: User, // ADDED
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number,
  ) {
    // Auto-filter by JWT restaurantId if not provided
    const targetRestaurantId = restaurantId || user.restaurantId;
    return this.tableService.findAll(targetRestaurantId);
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available tables' })
  @ApiQuery({ name: 'capacity', type: Number, required: false }) // Optional FIRST
  @ApiQuery({ name: 'restaurantId', type: Number, required: false }) // Optional SECOND
  findAvailable(
    @CurrentUser() user: User, // ADDED
    @Query('capacity') capacity?: number, // Optional FIRST
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number, // Optional SECOND
  ) {
    const targetRestaurantId = restaurantId || user.restaurantId;
    return this.tableService.findAvailableTables(
      targetRestaurantId,
      capacity ? parseInt(capacity.toString()) : undefined,
    );
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get tables by status' })
  @ApiQuery({ name: 'restaurantId', type: Number, required: false }) // Optional
  findByStatus(
    @CurrentUser() user: User, // ADDED
    @Param('status') status: TableStatus,
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number,
  ) {
    const targetRestaurantId = restaurantId || user.restaurantId;
    return this.tableService.findByStatus(targetRestaurantId, status);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get table statistics' })
  @ApiQuery({ name: 'restaurantId', type: Number, required: false }) // Optional
  getStatistics(
    @CurrentUser() user: User, // ADDED
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number,
  ) {
    const targetRestaurantId = restaurantId || user.restaurantId;
    return this.tableService.getTableStatistics(targetRestaurantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get table by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tableService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update table (ADMIN/OWNER/MANAGER)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTableDto: UpdateTableDto,
  ) {
    return this.tableService.update(id, updateTableDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Update table status' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateTableStatusDto,
  ) {
    return this.tableService.updateStatus(id, updateStatusDto.status);
  }

  @Patch(':id/occupy')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Occupy table (when customer is seated)' })
  occupyTable(@Param('id', ParseIntPipe) id: number) {
    return this.tableService.occupyTable(id);
  }

  @Patch(':id/release')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Release table (when customer leaves)' })
  releaseTable(@Param('id', ParseIntPipe) id: number) {
    return this.tableService.releaseTable(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete table (ADMIN/OWNER/MANAGER)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tableService.remove(id);
  }
}