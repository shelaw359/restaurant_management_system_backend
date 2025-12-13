import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { ReportsFilterDto } from './dto/reports-filter.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Dashboard endpoints
  @Get('sales-summary')
  getSalesSummary(@Query('restaurantId') restaurantId: number, @Query('days') days: number = 7): Promise<any> {
    return this.analyticsService.getSalesSummary(restaurantId, days);
  }

  @Get('daily-sales')
  getDailySales(@Query('restaurantId') restaurantId: number, @Query('days') days: number = 7): Promise<any> {
    return this.analyticsService.getDailySales(restaurantId, days);
  }

  @Get('hourly-sales')
  getHourlyAnalytics(@Query('restaurantId') restaurantId: number, @Query('days') days: number = 7): Promise<any> {
    return this.analyticsService.getHourlyAnalytics(restaurantId, days);
  }

  @Get('peak-hours')
  getPeakHours(@Query('restaurantId') restaurantId: number, @Query('days') days: number = 30): Promise<any> {
    return this.analyticsService.getPeakHours(restaurantId, days);
  }

  @Get('quick-stats')
  getQuickStats(@Query('restaurantId') restaurantId: number): Promise<any> {
    return this.analyticsService.getQuickStats(restaurantId);
  }

  @Get('top-items')
  getTopItems(
    @Query('restaurantId') restaurantId: number,
    @Query('limit') limit: number = 10,
    @Query('days') days: number = 30
  ): Promise<any> {
    return this.analyticsService.getTopItems(restaurantId, limit, days);
  }

  @Get('payment-methods')
  getPaymentAnalytics(@Query('restaurantId') restaurantId: number, @Query('days') days: number = 30): Promise<any> {
    return this.analyticsService.getPaymentAnalytics(restaurantId, days);
  }

  // REPORTS ENDPOINTS
  @Get('reports/summary')
  getReportsSummary(@Query() filterDto: ReportsFilterDto): Promise<any> {
    return this.analyticsService.getReportsSummary(filterDto);
  }

  @Get('reports/menu-performance')
  getMenuPerformanceReport(@Query() filterDto: ReportsFilterDto): Promise<any> {
    return this.analyticsService.getMenuPerformanceReport(filterDto);
  }

  @Get('reports/waiter-performance')
  getWaiterPerformanceReport(@Query() filterDto: ReportsFilterDto): Promise<any> {
    return this.analyticsService.getWaiterPerformanceReport(filterDto);
  }

  @Get('reports/payment-methods')
  getPaymentMethodsReport(@Query() filterDto: ReportsFilterDto): Promise<any> {
    return this.analyticsService.getPaymentMethodsReport(filterDto);
  }

  @Get('reports/inventory-status')
  getInventoryStatusReport(@Query() filterDto: ReportsFilterDto): Promise<any> {
    return this.analyticsService.getInventoryStatusReport(filterDto);
  }

  @Get('reports/reservations')
  getReservationsReport(@Query() filterDto: ReportsFilterDto): Promise<any> {
    return this.analyticsService.getReservationsReport(filterDto);
  }

  @Get('reports/sales-metrics')
  getSalesMetricsReport(@Query() filterDto: ReportsFilterDto): Promise<any> {
    return this.analyticsService.getSalesMetricsReport(filterDto);
  }
}