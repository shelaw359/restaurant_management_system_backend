// src/auth/dto/setup-admin.dto.ts

import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class SetupAdminDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string; // ← Use ? instead of | null

  @IsNotEmpty()
  @IsString()
  restaurantName: string;

  @IsNotEmpty()
  @IsString()
  restaurantPhone: string;

  @IsNotEmpty()
  @IsEmail()
  restaurantEmail: string;

  @IsNotEmpty()
  @IsString()
  restaurantAddress: string;
}