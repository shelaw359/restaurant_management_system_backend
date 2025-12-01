import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRestaurantDto {
  @ApiProperty({ example: "Mama's Kitchen" })
  @IsString()
  name: string;

  @ApiProperty({ example: '0712345678', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'info@restaurant.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '123 Main Street, Nairobi', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '09:00', required: false })
  @IsOptional()
  @IsString()
  openingTime?: string;

  @ApiProperty({ example: '22:00', required: false })
  @IsOptional()
  @IsString()
  closingTime?: string;

  @ApiProperty({ example: 'Africa/Nairobi', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logo?: string;
}
