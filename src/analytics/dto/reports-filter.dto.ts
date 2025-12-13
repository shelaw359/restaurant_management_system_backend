// src/analytics/dto/reports-filter.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsNumber, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentMethod } from '../../common/enums';

export class ReportsFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  restaurantId?: number = 1;

  @ApiProperty({ required: false, enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  @ApiProperty({ required: false, enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  waiterId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  itemCategory?: string;

  @ApiProperty({ required: false, enum: ['daily', 'weekly', 'monthly', 'custom'] })
  @IsOptional()
  @IsString()
  period?: string = 'daily';
}