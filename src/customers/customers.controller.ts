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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Create customer' })
  create(
    @CurrentUser() user: User,
    @Body() createCustomerDto: CreateCustomerDto,
  ) {
    return this.customerService.create({
      ...createCustomerDto,
      restaurantId: user.restaurantId,
    });
  }

  @Post('find-or-create')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Find existing customer or create new one' })
  findOrCreate(
    @CurrentUser() user: User,
    @Body() dto: FindOrCreateCustomerDto,
  ) {
    return this.customerService.findOrCreate(
      user.restaurantId,
      {
        phone: dto.phone,
        name: dto.name || 'Guest',
      }
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  @ApiQuery({ name: 'restaurantId', type: Number, required: false })
  findAll(
    @CurrentUser() user: User,
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number,
  ) {
    const targetRestaurantId = restaurantId || user.restaurantId;
    return this.customerService.findAll(targetRestaurantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search customers by name, phone, or email' })
  @ApiQuery({ name: 'term', type: String, required: true })
  @ApiQuery({ name: 'restaurantId', type: Number, required: false })
  search(
    @CurrentUser() user: User,
    @Query('term') term: string,
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number,
  ) {
    const targetRestaurantId = restaurantId || user.restaurantId;
    return this.customerService.search(targetRestaurantId, term);
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top customers by spending' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'restaurantId', type: Number, required: false })
  getTopCustomers(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number,
  ) {
    const targetRestaurantId = restaurantId || user.restaurantId;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.customerService.getTopCustomers(targetRestaurantId, limitNumber);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent customers' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'restaurantId', type: Number, required: false })
  getRecentCustomers(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number,
  ) {
    const targetRestaurantId = restaurantId || user.restaurantId;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.customerService.getRecentCustomers(targetRestaurantId, limitNumber);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get customer statistics' })
  @ApiQuery({ name: 'restaurantId', type: Number, required: false })
  getStatistics(
    @CurrentUser() user: User,
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number,
  ) {
    const targetRestaurantId = restaurantId || user.restaurantId;
    return this.customerService.getCustomerStatistics(targetRestaurantId);
  }

  @Get('phone/:phone')
  @ApiOperation({ summary: 'Find customer by phone number' })
  @ApiQuery({ name: 'restaurantId', type: Number, required: false })
  findByPhone(
    @CurrentUser() user: User,
    @Param('phone') phone: string,
    @Query('restaurantId', new ParseIntPipe({ optional: true })) restaurantId?: number,
  ) {
    const targetRestaurantId = restaurantId || user.restaurantId;
    return this.customerService.findByPhone(phone, targetRestaurantId);
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