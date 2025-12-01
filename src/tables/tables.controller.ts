
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

@ApiTags('Tables')
@Controller('tables')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create table (ADMIN/OWNER/MANAGER)' })
  create(@Body() createTableDto: CreateTableDto) {
    return this.tableService.create(createTableDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tables for a restaurant' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findAll(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.tableService.findAll(restaurantId);
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available tables' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  @ApiQuery({ name: 'capacity', type: Number, required: false })
  findAvailable(
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
    @Query('capacity') capacity?: number,
  ) {
    return this.tableService.findAvailableTables(
      restaurantId,
      capacity ? parseInt(capacity.toString()) : undefined,
    );
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get tables by status' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findByStatus(
    @Param('status') status: TableStatus,
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    return this.tableService.findByStatus(restaurantId, status);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get table statistics' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  getStatistics(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.tableService.getTableStatistics(restaurantId);
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