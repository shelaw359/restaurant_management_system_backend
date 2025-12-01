import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/entities/user.entity'; 
import { LoginDto } from './dto/login.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UserRole } from '../common/enums';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
  // Find user by email
  const user = await this.userRepository.findOne({
    where: { email: loginDto.email, isActive: true, canLogin: true },
    relations: ['restaurant'],
  });

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(
    loginDto.password,
    user.password,
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // Update last login
  user.lastLogin = new Date();
  await this.userRepository.save(user);

  // Generate JWT
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurantId,
  };

  return {
    access_token: this.jwtService.sign(payload),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      restaurant: user.restaurant,
    },
  };
}

  async createStaff(createStaffDto: CreateStaffDto, createdBy: any) {
    // Only ADMIN can create staff
    if (createdBy.role !== UserRole.ADMIN && createdBy.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only ADMIN or OWNER can create staff');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createStaffDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createStaffDto.password, 10);

    // Create staff
    const staff = this.userRepository.create({
      ...createStaffDto,
      password: hashedPassword,
      restaurantId: createStaffDto.restaurantId || createdBy.restaurantId,
    });

    const savedStaff = await this.userRepository.save(staff);

    // Remove password from response
    const { password, ...result } = savedStaff;
    return result;
  }

  async createFirstAdmin() {
    // Check if any users exist
    const userCount = await this.userRepository.count();

    if (userCount > 0) {
      throw new ConflictException('Admin already exists');
    }

    // Create first admin
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = this.userRepository.create({
      name: 'System Admin',
      email: 'admin@restaurant.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
      canLogin: true,
      isActive: true,
    });

    const savedAdmin = await this.userRepository.save(admin);

    const { password, ...result } = savedAdmin;
    return result;
  }

  async getAllStaff(user: any) {
    // Only ADMIN, OWNER, MANAGER can view all staff
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return await this.userRepository.find({
      where: { restaurantId: user.restaurantId },
      select: ['id', 'name', 'email', 'role', 'phone', 'isActive', 'lastLogin'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStaffStatus(staffId: number, isActive: boolean, user: any) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only ADMIN or OWNER can update staff status');
    }

    const staff = await this.userRepository.findOne({ where: { id: staffId } });

    if (!staff) {
      throw new UnauthorizedException('Staff not found');
    }

    staff.isActive = isActive;
    staff.canLogin = isActive;

    return await this.userRepository.save(staff);
  }
}
