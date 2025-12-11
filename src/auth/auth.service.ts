// src/auth/auth.service.ts

import { 
  Injectable, 
  BadRequestException, 
  UnauthorizedException,
  NotFoundException,
  ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity'; 
import { Restaurant } from '../restaurants/entities/restaurant.entity'; 
import { SetupAdminDto } from './dto/setup-admin.dto';
import { LoginDto } from './dto/login.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRole } from '../common/enums';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Setup first admin - Creates restaurant AND admin user
   * This should ONLY work if no users exist in the system
   */
  async setupAdmin(dto: SetupAdminDto) {
    const existingUserCount = await this.userRepository.count();
    
    if (existingUserCount > 0) {
      throw new BadRequestException('System already has users. Setup cannot be run again.');
    }

    const existingRestaurant = await this.restaurantRepository.findOne({
      where: { email: dto.restaurantEmail },
    });

    if (existingRestaurant) {
      throw new BadRequestException('Restaurant with this email already exists');
    }

    const restaurant = this.restaurantRepository.create({
      name: dto.restaurantName,
      phone: dto.restaurantPhone,
      email: dto.restaurantEmail,
      address: dto.restaurantAddress,
      isActive: true,
    });

    const savedRestaurant = await this.restaurantRepository.save(restaurant);

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const adminUser = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: UserRole.ADMIN,
      phone: dto.phone,
      restaurantId: savedRestaurant.id,
      isActive: true,
      canLogin: true,
    });

    const savedUser = await this.userRepository.save(adminUser);

    savedUser.lastLogin = new Date();
    await this.userRepository.save(savedUser);

    // Generate both access and refresh tokens
    const tokens = await this.generateTokens(savedUser);

    const { password, ...userWithoutPassword } = savedUser;

    return {
      ...tokens,
      user: userWithoutPassword,
    };
  }

  /**
   * Login with email and password
   */
  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'password', 'role', 'restaurantId', 'isActive', 'canLogin', 'name', 'phone'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been disabled. Please contact administrator.');
    }

    if (!user.canLogin) {
      throw new UnauthorizedException('Login access has been disabled for this account');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    user.lastLogin = new Date();
    await this.userRepository.save(user);

    // Generate both access and refresh tokens
    const tokens = await this.generateTokens(user);

    const { password, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
    };
  }

  /**
   * Refresh tokens - Stateless JWT verification
   */
  async refreshTokens(dto: RefreshTokenDto) {
    try {
      // Verify refresh token signature
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Check if user still exists and is active
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        select: ['id', 'email', 'role', 'restaurantId', 'isActive', 'canLogin'],
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive || !user.canLogin) {
        throw new UnauthorizedException('Account is disabled');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Create new staff member (ADMIN/OWNER only)
   */
  async createStaff(dto: CreateStaffDto, adminUser: User) {
    if (adminUser.role !== UserRole.ADMIN && adminUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only administrators can create staff members');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const validRoles = [
      UserRole.ADMIN,
      UserRole.OWNER, 
      UserRole.MANAGER,
      UserRole.WAITER,
      UserRole.CHEF
    ];

    const role = dto.role as UserRole;
    
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role. Valid roles are: ${validRoles.join(', ')}`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const staffData: Partial<User> = {
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: role,
      phone: dto.phone || undefined,
      restaurantId: adminUser.restaurantId,
      isActive: true,
      canLogin: true,
    };

    const staff = this.userRepository.create(staffData);
    const savedStaff = await this.userRepository.save(staff);

    const staffResponse = { ...savedStaff };
    delete (staffResponse as any).password;

    return staffResponse;
  }

  /**
   * Get all staff for a restaurant
   */
  async getAllStaff(user: User, filters?: { role?: UserRole; isActive?: boolean }) {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.restaurantId = :restaurantId', { restaurantId: user.restaurantId })
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.role',
        'user.phone',
        'user.restaurantId',
        'user.isActive',
        'user.canLogin',
        'user.lastLogin',
        'user.createdAt',
        'user.updatedAt',
      ]);

    if (filters?.role) {
      queryBuilder.andWhere('user.role = :role', { role: filters.role });
    }

    if (filters?.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive: filters.isActive });
    }

    return await queryBuilder.getMany();
  }

  /**
   * Get staff member by ID
   */
  async getStaffById(id: number, user: User) {
    const staff = await this.userRepository.findOne({
      where: { 
        id,
        restaurantId: user.restaurantId,
      },
      select: [
        'id',
        'name',
        'email',
        'role',
        'phone',
        'restaurantId',
        'isActive',
        'canLogin',
        'lastLogin',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    return staff;
  }

  /**
   * Update staff status (ADMIN/OWNER only)
   */
  async updateStaffStatus(
    id: number,
    updateData: UpdateStaffStatusDto,
    adminUser: User,
  ) {
    const staff = await this.userRepository.findOne({
      where: {
        id,
        restaurantId: adminUser.restaurantId,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (staff.id === adminUser.id) {
      throw new BadRequestException('You cannot modify your own status');
    }

    if (updateData.isActive !== undefined) {
      staff.isActive = updateData.isActive;
    }

    if (updateData.canLogin !== undefined) {
      staff.canLogin = updateData.canLogin;
    }

    const updatedStaff = await this.userRepository.save(staff);

    const staffResponse = { ...updatedStaff };
    delete (staffResponse as any).password;

    return staffResponse;
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'name',
        'email',
        'role',
        'phone',
        'restaurantId',
        'isActive',
        'canLogin',
        'lastLogin',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
    };

    const [access_token, refresh_token] = await Promise.all([
      // Access token - short lived (15 minutes)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      // Refresh token - long lived (7 days)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return {
      access_token,
      refresh_token,
    };
  }
}