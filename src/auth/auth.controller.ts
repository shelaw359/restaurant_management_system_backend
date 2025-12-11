// src/auth/auth.controller.ts

import { 
  Controller, 
  Post, 
  Get, 
  Patch,
  Body, 
  Param,
  Query,
  UseGuards,
  Request,
  Headers
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { LoginDto } from './dto/login.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffStatusDto } from './dto/update-staff-status.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('setup-admin')
  setupAdmin(@Body() dto: SetupAdminDto) {
    return this.authService.setupAdmin(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    console.log('✅ /me endpoint - User from request:', req.user);
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Post('staff')
  createStaff(@Body() dto: CreateStaffDto, @Request() req) {
    return this.authService.createStaff(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @Get('staff')
  getAllStaff(
    @Request() req,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: boolean,
  ) {
    const filters = { role, isActive };
    return this.authService.getAllStaff(req.user, filters);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @Get('staff/:id')
  getStaffById(@Param('id') id: number, @Request() req) {
    return this.authService.getStaffById(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Patch('staff/:id/status')
  updateStaffStatus(
    @Param('id') id: number,
    @Body() dto: UpdateStaffStatusDto,
    @Request() req,
  ) {
    return this.authService.updateStaffStatus(id, dto, req.user);
  }

  // DEBUG ENDPOINT - Test JWT verification
  @Get('debug-jwt')
  debugJwt(@Headers('authorization') authHeader: string) {
    try {
      const token = authHeader?.replace('Bearer ', '');
      
      if (!token) {
        return { 
          success: false, 
          error: 'No Authorization header or token provided' 
        };
      }

      console.log('🔍 Debug JWT - Token received (first 50 chars):', token.substring(0, 50) + '...');
      
      const decoded = this.jwtService.decode(token);
      console.log('🔍 Decoded payload (no verification):', decoded);
      
      const verified = this.jwtService.verify(token);
      console.log('🔍 Verified payload:', verified);
      
      return {
        success: true,
        decoded,
        verified,
        tokenPreview: token.substring(0, 50) + '...',
      };
    } catch (error) {
      console.error('❌ JWT Debug Error:', error.message);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  // DEBUG ENDPOINT 2 - Test without guard
  @Get('debug-me')
  debugMe(@Headers('authorization') authHeader: string) {
    try {
      const token = authHeader?.replace('Bearer ', '');
      
      if (!token) {
        return { 
          success: false, 
          error: 'No token provided' 
        };
      }

      const decoded: any = this.jwtService.decode(token);
      
      if (!decoded || !decoded.sub) {
        return { 
          success: false, 
          error: 'Invalid token - no user ID found' 
        };
      }

      console.log('🔍 Debug ME - User ID from token:', decoded.sub);
      
      return this.authService.getProfile(decoded.sub);
      
    } catch (error) {
      console.error('❌ Debug ME Error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}