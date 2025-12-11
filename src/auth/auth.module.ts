import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from 'src/users/entities/user.entity'; 
import { Restaurant } from 'src/restaurants/entities/restaurant.entity'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Restaurant]),
    PassportModule.register({ defaultStrategy: 'jwt' }), // ✅ FIXED: Added register()
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'restaurant-management-system-secret-2024-change-this', // ✅ Use same secret
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule], // ✅ Added PassportModule to exports
})
export class AuthModule {}