import { IsInt, IsEnum, IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../common/enums';

export class CreatePaymentDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  orderId: number;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: 'TXN123456789', required: false })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ example: 'Customer paid in full', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
