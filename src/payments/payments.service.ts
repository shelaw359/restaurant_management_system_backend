import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentStatus, OrderStatus } from '../common/enums/index';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    // 1. Check if order exists
    const order = await this.orderRepository.findOne({
      where: { id: createPaymentDto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order #${createPaymentDto.orderId} not found`);
    }

    // 2. Check if payment already exists
    const existingPayment = await this.paymentRepository.findOne({
      where: { orderId: createPaymentDto.orderId },
    });

    if (existingPayment) {
      throw new ConflictException('Payment already exists for this order');
    }

    // 3. Validate payment amount
    if (createPaymentDto.amount !== Number(order.total)) {
      throw new BadRequestException(
        `Payment amount (${createPaymentDto.amount}) must match order total (${order.total})`,
      );
    }

    // 4. Create payment - allow status from DTO or default to PENDING
    const payment = this.paymentRepository.create({
      orderId: createPaymentDto.orderId,
      paymentNumber: await this.generatePaymentNumber(),
      amount: createPaymentDto.amount,
      method: createPaymentDto.method,
      transactionId: createPaymentDto.transactionId,
      notes: createPaymentDto.notes,
      status: createPaymentDto.status || PaymentStatus.PENDING,
    });

    return await this.paymentRepository.save(payment);
  }

  async processPayment(orderId: number, processDto: ProcessPaymentDto): Promise<Payment> {
    // 1. Check if order exists
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['payment'],
    });

    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    // 2. Check if payment exists or create it
    let payment = order.payment || null;

    if (!payment) {
      payment = this.paymentRepository.create({
        orderId: order.id,
        paymentNumber: await this.generatePaymentNumber(),
        amount: order.total,
        method: processDto.method,
        transactionId: processDto.transactionId,
        notes: processDto.notes,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });
    } else {
      // Update existing payment
      payment.method = processDto.method;
      payment.transactionId = processDto.transactionId || payment.transactionId;
      payment.notes = processDto.notes || payment.notes;
      payment.status = PaymentStatus.COMPLETED;
      payment.paidAt = new Date();
    }

    const savedPayment = await this.paymentRepository.save(payment);

    // ✅ Update order status to PAID
    if (order.status !== OrderStatus.PAID) {
      order.status = OrderStatus.PAID;
      order.completedAt = new Date();
      await this.orderRepository.save(order);
    }

    return await this.findOne(savedPayment.id);
  }

  async findAll(restaurantId: number): Promise<Payment[]> {
    return await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .leftJoinAndSelect('order.table', 'table')
      .leftJoinAndSelect('order.waiter', 'waiter')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('order.restaurantId = :restaurantId', { restaurantId })
      .orderBy('payment.createdAt', 'DESC')
      .getMany();
  }

  async findByStatus(restaurantId: number, status: PaymentStatus): Promise<Payment[]> {
    return await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .leftJoinAndSelect('order.table', 'table')
      .where('order.restaurantId = :restaurantId', { restaurantId })
      .andWhere('payment.status = :status', { status })
      .orderBy('payment.createdAt', 'DESC')
      .getMany();
  }

  async findByOrder(orderId: number): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
      relations: ['order', 'order.table', 'order.waiter', 'order.customer'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment for order #${orderId} not found`);
    }

    return payment;
  }

  async findOne(id: number): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: [
        'order',
        'order.orderItems',
        'order.orderItems.menuItem',
        'order.table',
        'order.waiter',
        'order.customer',
      ],
    });

    if (!payment) {
      throw new NotFoundException(`Payment #${id} not found`);
    }

    return payment;
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto): Promise<Payment> {
    const payment = await this.findOne(id);

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Cannot update completed payment');
    }

    Object.assign(payment, updatePaymentDto);

    if (updatePaymentDto.status === PaymentStatus.COMPLETED) {
      payment.paidAt = new Date();
    }

    await this.paymentRepository.save(payment);
    return await this.findOne(id);
  }

  async refund(id: number, notes?: string): Promise<Payment> {
    const payment = await this.findOne(id);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.notes = notes || payment.notes;

    // Update order status
    const order = await this.orderRepository.findOne({
      where: { id: payment.orderId },
    });

    if (order) {
      order.status = OrderStatus.CANCELLED;
      await this.orderRepository.save(order);
    }

    await this.paymentRepository.save(payment);
    return await this.findOne(id);
  }

  async getDailyRevenue(restaurantId: number, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .where('order.restaurantId = :restaurantId', { restaurantId })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.paidAt BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .getMany();

    const revenue = {
      date: date.toISOString().split('T')[0],
      totalPayments: payments.length,
      totalRevenue: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      byMethod: {} as Record<string, { count: number; amount: number }>,
    };

    // Group by payment method
    payments.forEach((payment) => {
      if (!revenue.byMethod[payment.method]) {
        revenue.byMethod[payment.method] = { count: 0, amount: 0 };
      }
      revenue.byMethod[payment.method].count++;
      revenue.byMethod[payment.method].amount += Number(payment.amount);
    });

    return revenue;
  }

  async getPaymentStatistics(restaurantId: number, startDate: Date, endDate: Date) {
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .where('order.restaurantId = :restaurantId', { restaurantId })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('payment.paidAt BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .getMany();

    return {
      totalTransactions: payments.length,
      totalRevenue: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      averageTransaction:
        payments.length > 0
          ? payments.reduce((sum, p) => sum + Number(p.amount), 0) / payments.length
          : 0,
      byMethod: payments.reduce((acc, payment) => {
        if (!acc[payment.method]) {
          acc[payment.method] = { count: 0, amount: 0 };
        }
        acc[payment.method].count++;
        acc[payment.method].amount += Number(payment.amount);
        return acc;
      }, {} as Record<string, { count: number; amount: number }>),
    };
  }

  async updatePaymentStatus(orderId: number, status: PaymentStatus): Promise<Payment> {
    const payment = await this.findByOrder(orderId);
    
    if (!payment) {
      throw new NotFoundException(`Payment for order #${orderId} not found`);
    }

    payment.status = status;
    
    if (status === PaymentStatus.COMPLETED) {
      payment.paidAt = new Date();
    }

    return await this.paymentRepository.save(payment);
  }

  private async generatePaymentNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `PAY-${dateStr}-${random}`;
  }
}