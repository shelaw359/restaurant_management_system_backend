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
import { CustomerService } from './customers.service'; 
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { FindOrCreateCustomerDto } from './dto/find-or-create-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Create customer' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.create(createCustomerDto);
  }

  @Post('find-or-create')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Find existing customer or create new one' })
  findOrCreate(@Body() dto: FindOrCreateCustomerDto) {
    return this.customerService.findOrCreate(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findAll(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.customerService.findAll(restaurantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search customers by name, phone, or email' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  @ApiQuery({ name: 'term', type: String })
  search(
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
    @Query('term') term: string,
  ) {
    return this.customerService.search(restaurantId, term);
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top customers by spending' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  getTopCustomers(
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
    @Query('limit') limit?: number,
  ) {
    return this.customerService.getTopCustomers(
      restaurantId,
      limit ? parseInt(limit.toString()) : 10,
    );
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent customers' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  getRecentCustomers(
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
    @Query('limit') limit?: number,
  ) {
    return this.customerService.getRecentCustomers(
      restaurantId,
      limit ? parseInt(limit.toString()) : 10,
    );
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get customer statistics' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  getStatistics(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.customerService.getCustomerStatistics(restaurantId);
  }

  @Get('phone/:phone')
  @ApiOperation({ summary: 'Find customer by phone number' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findByPhone(
    @Param('phone') phone: string,
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    return this.customerService.findByPhone(phone, restaurantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Update customer' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customerService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete customer (ADMIN/OWNER/MANAGER)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.remove(id);
  }
}
