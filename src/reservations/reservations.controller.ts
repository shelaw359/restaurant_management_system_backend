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
import { ReservationService } from './reservations.service'; 
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation.dto'; 
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, ReservationStatus } from '../common/enums';

@ApiTags('Reservations')
@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Create reservation' })
  create(@Body() createReservationDto: CreateReservationDto) {
    return this.reservationService.create(createReservationDto);
  }

  @Post('check-availability')
  @ApiOperation({ summary: 'Check table availability' })
  checkAvailability(@Body() checkAvailabilityDto: CheckAvailabilityDto) {
    return this.reservationService.checkAvailability(checkAvailabilityDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reservations' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findAll(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.reservationService.findAll(restaurantId);
  }

  @Get('date/:date')
  @ApiOperation({ summary: 'Get reservations by date' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findByDate(
    @Param('date') date: string,
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    return this.reservationService.findByDate(restaurantId, date);
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get reservations by status' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findByStatus(
    @Param('status') status: ReservationStatus,
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    return this.reservationService.findByStatus(restaurantId, status);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming confirmed reservations' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  findUpcoming(@Query('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.reservationService.findUpcoming(restaurantId);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get reservation statistics' })
  @ApiQuery({ name: 'restaurantId', type: Number })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  getStatistics(
    @Query('restaurantId', ParseIntPipe) restaurantId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reservationService.getReservationStatistics(
      restaurantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reservation by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Update reservation' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateReservationDto: UpdateReservationDto,
  ) {
    return this.reservationService.update(id, updateReservationDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({ summary: 'Update reservation status' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() statusDto: UpdateReservationStatusDto,
  ) {
    return this.reservationService.updateStatus(id, statusDto.status);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel reservation' })
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.reservationService.cancel(id);
  }
}
