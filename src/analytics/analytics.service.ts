import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MenuItem } from '../menu-items/entities/menu-item.entity';
import { OrderItem } from '../order-items/entities/order-item.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { InventoryItem } from '../inventory-items/entities/inventory-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { 
  OrderStatus, 
  PaymentMethod, 
  PaymentStatus,
  ReservationStatus 
} from '../common/enums';
import { ReportsFilterDto } from './dto/reports-filter.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(InventoryItem)
    private inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  private readonly WORKING_HOURS = {
    start: 6,
    end: 22
  };

  // ================== REPORTS METHODS ==================
  async getReportsSummary(filterDto: ReportsFilterDto): Promise<any> {
    const { startDate, endDate, restaurantId, period } = filterDto;
    
    const dateRange = this.getDateRangeFromPeriod(startDate, endDate, period);
    const restId = restaurantId || 1;

    const [orders, payments, reservations, inventoryItems] = await Promise.all([
      this.getFilteredOrders(restId, dateRange, filterDto),
      this.getFilteredPayments(restId, dateRange, filterDto),
      this.reservationRepository.find({
        where: {
          restaurantId: restId,
          reservationTime: Between(dateRange.start.toISOString(), dateRange.end.toISOString())
        }
      }),
      this.inventoryItemRepository.find({ where: { restaurantId: restId } })
    ]);

    return {
      salesMetrics: this.calculateSalesMetrics(orders, payments),
      menuPerformance: this.calculateMenuPerformance(orders),
      paymentMethods: this.calculatePaymentMethods(payments),
      waiterPerformance: this.calculateWaiterPerformance(orders),
      reservationMetrics: this.calculateReservationMetrics(reservations),
      inventoryStatus: this.calculateInventoryStatus(inventoryItems),
    };
  }

  private getDateRangeFromPeriod(startDate?: string, endDate?: string, period?: string): { start: Date; end: Date } {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    
    if (!startDate && !endDate && period) {
      switch(period) {
        case 'daily':
          start.setDate(start.getDate() - 1);
          break;
        case 'weekly':
          start.setDate(start.getDate() - 7);
          break;
        case 'monthly':
          start.setMonth(start.getMonth() - 1);
          break;
      }
    }
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }

  private async getFilteredOrders(
    restaurantId: number, 
    dateRange: { start: Date; end: Date },
    filters: ReportsFilterDto
  ): Promise<Order[]> {
    const where: any = {
      restaurantId,
      createdAt: Between(dateRange.start, dateRange.end)
    };

    if (filters.orderStatus) {
      where.status = filters.orderStatus;
    }

    if (filters.waiterId) {
      where.waiterId = filters.waiterId;
    }

    if (filters.minAmount) {
      where.total = MoreThanOrEqual(filters.minAmount);
    }

    if (filters.maxAmount) {
      where.total = LessThanOrEqual(filters.maxAmount);
    }

    return this.orderRepository.find({
      where,
      relations: ['orderItems', 'orderItems.menuItem']
    });
  }

  private async getFilteredPayments(
    restaurantId: number, 
    dateRange: { start: Date; end: Date },
    filters: ReportsFilterDto
  ): Promise<Payment[]> {
    const where: any = {
      paidAt: Between(dateRange.start, dateRange.end)
    };

    if (filters.paymentMethod) {
      where.method = filters.paymentMethod;
    }

    const payments = await this.paymentRepository.find({
      where,
      relations: ['order']
    });

    return payments.filter(payment => payment.order?.restaurantId === restaurantId);
  }

  private calculateSalesMetrics(orders: Order[], payments: Payment[]) {
    const completedOrders = orders.filter(o => 
      o.status === OrderStatus.COMPLETED || 
      o.status === OrderStatus.PAID
    );

    const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const totalOrders = completedOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      completedOrders: completedOrders.length
    };
  }

  private calculateMenuPerformance(orders: Order[]) {
    const itemSales = new Map<number, { name: string; quantity: number; revenue: number }>();

    orders.forEach(order => {
      order.orderItems?.forEach(item => {
        const itemId = item.menuItemId;
        const existing = itemSales.get(itemId) || {
          name: item.menuItem?.name || `Item ${itemId}`,
          quantity: 0,
          revenue: 0
        };
        
        itemSales.set(itemId, {
          ...existing,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + (item.totalPrice || 0)
        });
      });
    });

    const sortedItems = Array.from(itemSales.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity);

    return {
      mostSold: sortedItems.slice(0, 5),
      leastSold: sortedItems.slice(-5).reverse()
    };
  }

  private calculatePaymentMethods(payments: Payment[]) {
    const methodCount = new Map<string, { count: number; total: number }>();

    payments.forEach(payment => {
      const method = payment.method || 'UNKNOWN';
      const existing = methodCount.get(method) || { count: 0, total: 0 };
      
      methodCount.set(method, {
        count: existing.count + 1,
        total: existing.total + Number(payment.amount)
      });
    });

    const totalAmount = Array.from(methodCount.values())
      .reduce((sum, item) => sum + item.total, 0);

    return Array.from(methodCount.entries())
      .map(([method, data]) => ({
        method,
        count: data.count,
        total: data.total,
        percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }

  private calculateWaiterPerformance(orders: Order[]) {
    const waiterStats = new Map<number, { name: string; orders: number; revenue: number }>();

    orders.forEach(order => {
      if (order.waiterId) {
        const existing = waiterStats.get(order.waiterId) || {
          name: `Waiter ${order.waiterId}`,
          orders: 0,
          revenue: 0
        };
        
        waiterStats.set(order.waiterId, {
          ...existing,
          orders: existing.orders + 1,
          revenue: existing.revenue + order.total
        });
      }
    });

    const sortedStats = Array.from(waiterStats.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.orders - a.orders);

    return {
      highest: sortedStats.slice(0, 5),
      lowest: sortedStats.slice(-5).reverse()
    };
  }

  private calculateReservationMetrics(reservations: Reservation[]) {
    return {
      total: reservations.length,
      confirmed: reservations.filter(r => r.status === ReservationStatus.CONFIRMED).length,
      completed: reservations.filter(r => r.status === ReservationStatus.COMPLETED).length,
      cancelled: reservations.filter(r => r.status === ReservationStatus.CANCELLED).length,
    };
  }

    private calculateInventoryStatus(inventoryItems: InventoryItem[]) {
    // Your InventoryItem only has 'quantity' property
    // Define a minimum stock threshold (e.g., 10 units)
    const MIN_STOCK_THRESHOLD = 10;
    
    const lowStockItems = inventoryItems.filter(item => 
      item.quantity <= MIN_STOCK_THRESHOLD && item.quantity > 0
    );
    
    const outOfStockItems = inventoryItems.filter(item => 
      item.quantity <= 0
    );

    return {
      totalItems: inventoryItems.length,
      lowStock: lowStockItems.length,
      outOfStock: outOfStockItems.length,
      lowStockItems: lowStockItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        stock: item.quantity,
      })),
      outOfStockItems: outOfStockItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
      })),
    };
  }

  async getMenuPerformanceReport(filterDto: ReportsFilterDto): Promise<any> {
    const summary = await this.getReportsSummary(filterDto);
    return summary.menuPerformance;
  }

  async getWaiterPerformanceReport(filterDto: ReportsFilterDto): Promise<any> {
    const summary = await this.getReportsSummary(filterDto);
    return summary.waiterPerformance;
  }

  async getPaymentMethodsReport(filterDto: ReportsFilterDto): Promise<any> {
    const summary = await this.getReportsSummary(filterDto);
    return summary.paymentMethods;
  }

  async getInventoryStatusReport(filterDto: ReportsFilterDto): Promise<any> {
    const { restaurantId } = filterDto;
    const inventoryItems = await this.inventoryItemRepository.find({ 
      where: { restaurantId: restaurantId || 1 } 
    });
    return this.calculateInventoryStatus(inventoryItems);
  }

  async getReservationsReport(filterDto: ReportsFilterDto): Promise<any> {
    const summary = await this.getReportsSummary(filterDto);
    return summary.reservationMetrics;
  }

  async getSalesMetricsReport(filterDto: ReportsFilterDto): Promise<any> {
    const summary = await this.getReportsSummary(filterDto);
    return summary.salesMetrics;
  }

  // ================== DASHBOARD METHODS ==================
  async getSalesSummary(restaurantId: number, days: number = 7): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [orders, payments] = await Promise.all([
      this.orderRepository.find({
        where: {
          restaurantId,
          createdAt: Between(startDate, endDate),
        },
      }),
      this.paymentRepository.find({
        where: {
          paidAt: Between(startDate, endDate),
        },
        relations: ['order'],
      }),
    ]);

    const restaurantPayments = payments.filter(
      payment => payment.order?.restaurantId === restaurantId
    );

    const todaysRevenue = restaurantPayments
      .filter(p => new Date(p.paidAt).toDateString() === new Date().toDateString())
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const yesterdaysRevenue = restaurantPayments
      .filter(p => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return new Date(p.paidAt).toDateString() === yesterday.toDateString();
      })
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const revenueChange = yesterdaysRevenue > 0 
      ? ((todaysRevenue - yesterdaysRevenue) / yesterdaysRevenue) * 100 
      : todaysRevenue > 0 ? 100 : 0;

    return {
      overview: {
        todaysRevenue,
        yesterdaysRevenue,
        revenueChange: parseFloat(revenueChange.toFixed(1)),
        totalOrders: orders.length,
        completedOrders: orders.filter(o => o.status === OrderStatus.COMPLETED).length,
        pendingOrders: orders.filter(o => o.status === OrderStatus.PENDING).length,
        averageOrderValue: restaurantPayments.length > 0 
          ? restaurantPayments.reduce((sum, p) => sum + Number(p.amount), 0) / restaurantPayments.length
          : 0,
      },
      recentPeriod: {
        days,
        totalRevenue: restaurantPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        totalOrders: orders.length,
        completedPayments: restaurantPayments.filter(p => p.status === PaymentStatus.COMPLETED).length,
        workingHours: `${this.WORKING_HOURS.start}:00 - ${this.WORKING_HOURS.end}:00`
      }
    };
  }

  async getDailySales(restaurantId: number, days: number = 7): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .where('order.restaurantId = :restaurantId', { restaurantId })
      .andWhere('payment.paidAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const dailyMap = new Map<string, { revenue: number; orders: Set<number> }>();
    
    payments.forEach(payment => {
      if (!payment.paidAt) return;
      
      const dateKey = new Date(payment.paidAt).toISOString().split('T')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { revenue: 0, orders: new Set<number>() });
      }
      
      const dayData = dailyMap.get(dateKey)!;
      dayData.revenue += Number(payment.amount);
      if (payment.orderId) dayData.orders.add(payment.orderId);
    });

    const result: any[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      const dayData = dailyMap.get(dateKey) || { revenue: 0, orders: new Set<number>() };
      
      result.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: parseFloat(dayData.revenue.toFixed(2)),
        orders: dayData.orders.size,
        averageOrderValue: dayData.orders.size > 0 
          ? parseFloat((dayData.revenue / dayData.orders.size).toFixed(2))
          : 0,
      });
    }

    return result;
  }

  async getHourlyAnalytics(restaurantId: number, days: number = 7): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await this.orderRepository.find({
      where: {
        restaurantId,
        createdAt: Between(startDate, endDate),
        status: OrderStatus.COMPLETED,
      },
      relations: ['payment'],
    });

    const hourMap = new Map<number, { orders: number; revenue: number }>();
    
    for (let hour = this.WORKING_HOURS.start; hour <= this.WORKING_HOURS.end; hour++) {
      hourMap.set(hour, { orders: 0, revenue: 0 });
    }

    orders.forEach(order => {
      if (!order.createdAt) return;
      
      const hour = new Date(order.createdAt).getHours();
      if (hour >= this.WORKING_HOURS.start && hour <= this.WORKING_HOURS.end) {
        const hourData = hourMap.get(hour)!;
        hourData.orders += 1;
        
        if (order.payment) {
          hourData.revenue += Number(order.payment.amount);
        }
      }
    });

    const allOrders = Array.from(hourMap.values()).map(data => data.orders);
    const maxOrders = Math.max(...allOrders);
    const peakThreshold = maxOrders * 0.7;

    return Array.from(hourMap.entries())
      .map(([hour, data]) => ({
        hour,
        orders: data.orders,
        revenue: parseFloat(data.revenue.toFixed(2)),
        label: `${hour}:00`,
        isPeakHour: data.orders > 0 && data.orders >= peakThreshold,
      }))
      .filter(data => data.orders > 0 || data.revenue > 0);
  }

  async getPeakHours(restaurantId: number, days: number = 30): Promise<any> {
    const hourlyData = await this.getHourlyAnalytics(restaurantId, days);
    
    const peakHours = hourlyData
      .filter(data => data.isPeakHour)
      .sort((a, b) => b.orders - a.orders);

    const totalRevenue = hourlyData.reduce((sum, data) => sum + data.revenue, 0);
    const totalOrders = hourlyData.reduce((sum, data) => sum + data.orders, 0);

    return {
      peakHours: peakHours.slice(0, 3),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      averageHourlyRevenue: totalRevenue / (hourlyData.length || 1),
      recommendation: this.generatePeakHourRecommendation(peakHours),
    };
  }

  private generatePeakHourRecommendation(peakHours: any[]): string {
    if (peakHours.length === 0) return "No peak hours detected";
    
    const peakHour = peakHours[0];
    return `Busiest at ${peakHour.label} with ${peakHour.orders} orders. Consider adding staff during this hour.`;
  }

  async getQuickStats(restaurantId: number): Promise<any> {
    const today = new Date();
    today.setHours(this.WORKING_HOURS.start, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayOrders, todayPayments, hourlyData] = await Promise.all([
      this.orderRepository.find({
        where: {
          restaurantId,
          createdAt: Between(today, tomorrow),
        },
      }),
      this.paymentRepository.find({
        where: {
          paidAt: Between(today, tomorrow),
        },
        relations: ['order'],
      }),
      this.getHourlyAnalytics(restaurantId, 1),
    ]);

    const todaysRevenue = todayPayments
      .filter(p => p.order?.restaurantId === restaurantId)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const currentHour = new Date().getHours();
    const isOpen = currentHour >= this.WORKING_HOURS.start && currentHour <= this.WORKING_HOURS.end;
    
    const currentHourData = hourlyData.find(data => data.hour === currentHour) || {
      orders: 0,
      revenue: 0,
    };

    const nextPeakHour = this.getNextPeakHour(hourlyData, currentHour);

    return {
      isOpen,
      currentHour: `${currentHour}:00`,
      todaysOrders: todayOrders.length,
      todaysRevenue: parseFloat(todaysRevenue.toFixed(2)),
      currentHourOrders: currentHourData.orders,
      currentHourRevenue: currentHourData.revenue,
      nextPeakHour,
      workingHours: `${this.WORKING_HOURS.start}:00 - ${this.WORKING_HOURS.end}:00`,
    };
  }

  private getNextPeakHour(hourlyData: any[], currentHour: number) {
    const upcomingHours = hourlyData.filter(data => data.hour > currentHour);
    if (upcomingHours.length === 0) return null;
    
    const nextPeak = upcomingHours.reduce((prev, current) => 
      prev.orders > current.orders ? prev : current
    );
    
    return {
      hour: nextPeak.hour,
      label: nextPeak.label,
      expectedOrders: nextPeak.orders,
    };
  }

  async getTopItems(restaurantId: number, limit: number = 10, days: number = 30): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orderItems = await this.orderItemRepository
      .createQueryBuilder('orderItem')
      .leftJoinAndSelect('orderItem.order', 'order')
      .leftJoinAndSelect('orderItem.menuItem', 'menuItem')
      .where('order.restaurantId = :restaurantId', { restaurantId })
      .andWhere('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .getMany();

    const itemMap = new Map<number, { 
      name: string; 
      category: string; 
      quantity: number; 
      revenue: number; 
    }>();

    let totalRevenue = 0;

    orderItems.forEach(item => {
      if (!item.menuItem) return;

      const itemId = item.menuItem.id;
      const revenue = Number(item.quantity) * Number(item.unitPrice);
      
      if (!itemMap.has(itemId)) {
        itemMap.set(itemId, {
          name: item.menuItem.name,
          category: item.menuItem.category?.name || 'Uncategorized',
          quantity: 0,
          revenue: 0,
        });
      }

      const itemData = itemMap.get(itemId)!;
      itemData.quantity += item.quantity;
      itemData.revenue += revenue;
      totalRevenue += revenue;
    });

    const items = Array.from(itemMap.entries()).map(([itemId, data]) => ({
      itemId,
      ...data,
      percentage: totalRevenue > 0 ? parseFloat(((data.revenue / totalRevenue) * 100).toFixed(1)) : 0,
    }));

    return items
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .map(item => ({
        ...item,
        revenue: parseFloat(item.revenue.toFixed(2)),
      }));
  }

  async getPaymentAnalytics(restaurantId: number, days: number = 30): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .where('order.restaurantId = :restaurantId', { restaurantId })
      .andWhere('payment.paidAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getMany();

    const methodMap = new Map<PaymentMethod, { count: number; amount: number }>();
    
    payments.forEach(payment => {
      const method = payment.method as PaymentMethod;
      if (!methodMap.has(method)) {
        methodMap.set(method, { count: 0, amount: 0 });
      }
      
      const methodData = methodMap.get(method)!;
      methodData.count += 1;
      methodData.amount += Number(payment.amount);
    });

    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amount: parseFloat(data.amount.toFixed(2)),
      percentage: totalAmount > 0 
        ? parseFloat(((data.amount / totalAmount) * 100).toFixed(1))
        : 0,
    })).sort((a, b) => b.amount - a.amount);
  }
}