import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Customer } from './entities/customer.entity'; 
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { FindOrCreateCustomerDto } from './dto/find-or-create-customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    // Check if phone already exists
    const existing = await this.customerRepository.findOne({
      where: {
        phone: createCustomerDto.phone,
        restaurantId: createCustomerDto.restaurantId,
      },
    });

    if (existing) {
      throw new ConflictException('Customer with this phone number already exists');
    }

    const customer = this.customerRepository.create(createCustomerDto);
    return await this.customerRepository.save(customer);
  }

  async findOrCreate(dto: FindOrCreateCustomerDto): Promise<Customer> {
    // Try to find existing customer by phone
    let customer = await this.customerRepository.findOne({
      where: {
        phone: dto.phone,
        restaurantId: dto.restaurantId,
      },
    });

    // If not found, create new customer
    if (!customer) {
      customer = this.customerRepository.create({
        phone: dto.phone,
        name: dto.name || 'Guest',
        restaurantId: dto.restaurantId,
      });
      await this.customerRepository.save(customer);
    }

    return customer;
  }

  async findAll(restaurantId: number): Promise<Customer[]> {
    return await this.customerRepository.find({
      where: { restaurantId, isActive: true },
      order: { lastVisit: 'DESC', name: 'ASC' },
    });
  }

  async search(restaurantId: number, searchTerm: string): Promise<Customer[]> {
    return await this.customerRepository.find({
      where: [
        { restaurantId, name: Like(`%${searchTerm}%`), isActive: true },
        { restaurantId, phone: Like(`%${searchTerm}%`), isActive: true },
        { restaurantId, email: Like(`%${searchTerm}%`), isActive: true },
      ],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['restaurant'],
    });

    if (!customer) {
      throw new NotFoundException(`Customer #${id} not found`);
    }

    return customer;
  }

  async findByPhone(phone: string, restaurantId: number): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { phone, restaurantId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with phone ${phone} not found`);
    }

    return customer;
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    // Check if changing phone to existing number
    if (updateCustomerDto.phone && updateCustomerDto.phone !== customer.phone) {
      const existing = await this.customerRepository.findOne({
        where: {
          phone: updateCustomerDto.phone,
          restaurantId: customer.restaurantId,
        },
      });

      if (existing) {
        throw new ConflictException('Phone number already in use');
      }
    }

    Object.assign(customer, updateCustomerDto);
    return await this.customerRepository.save(customer);
  }

  async updateStats(
    id: number,
    orderAmount: number,
  ): Promise<Customer> {
    const customer = await this.findOne(id);

    customer.totalOrders += 1;
    customer.totalSpent = Number(customer.totalSpent) + Number(orderAmount);
    customer.lastVisit = new Date();

    return await this.customerRepository.save(customer);
  }

  async remove(id: number): Promise<void> {
    const customer = await this.findOne(id);
    customer.isActive = false;
    await this.customerRepository.save(customer);
  }

  async getTopCustomers(restaurantId: number, limit: number = 10) {
    return await this.customerRepository.find({
      where: { restaurantId, isActive: true },
      order: { totalSpent: 'DESC' },
      take: limit,
    });
  }

  async getRecentCustomers(restaurantId: number, limit: number = 10) {
    return await this.customerRepository.find({
      where: { restaurantId, isActive: true },
      order: { lastVisit: 'DESC' },
      take: limit,
    });
  }

  async getCustomerStatistics(restaurantId: number) {
    const customers = await this.findAll(restaurantId);

    return {
      totalCustomers: customers.length,
      totalRevenue: customers.reduce((sum, c) => sum + Number(c.totalSpent), 0),
      averageOrderValue:
        customers.length > 0
          ? customers.reduce((sum, c) => sum + Number(c.totalSpent), 0) /
            customers.reduce((sum, c) => sum + c.totalOrders, 0)
          : 0,
      repeatCustomers: customers.filter((c) => c.totalOrders > 1).length,
    };
  }
}