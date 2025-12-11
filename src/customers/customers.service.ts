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

  async findOrCreate(
    restaurantId: number,
    data: { phone: string; name: string },
  ): Promise<Customer> {
    let customer = await this.customerRepository.findOne({
      where: {
        phone: data.phone,
        restaurantId: restaurantId,
      },
    });

    if (!customer) {
      const customerData = {
        restaurantId: restaurantId,
        phone: data.phone,
        name: data.name,
        totalOrders: 0,
        totalSpent: 0,
        isActive: true,
      };

      const newCustomer = this.customerRepository.create(customerData);
      customer = await this.customerRepository.save(newCustomer);
      console.log(`✅ New customer created: ${customer.name} (${customer.phone})`);
    } else {
      console.log(`✅ Existing customer found: ${customer.name} (ID: ${customer.id})`);
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

  async updateStats(id: number, orderAmount: number): Promise<Customer> {
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
        customers.length > 0 && customers.reduce((sum, c) => sum + c.totalOrders, 0) > 0
          ? customers.reduce((sum, c) => sum + Number(c.totalSpent), 0) /
            customers.reduce((sum, c) => sum + c.totalOrders, 0)
          : 0,
      repeatCustomers: customers.filter((c) => c.totalOrders > 1).length,
    };
  }
}