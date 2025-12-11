import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '../../common/enums';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Order ID', example: 1 })
  @IsNumber()
  orderId: number;

  @ApiProperty({ description: 'Payment amount', example: 100.00 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method', example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, description: 'Payment status', required: false, example: PaymentStatus.PENDING })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiProperty({ description: 'Transaction ID', required: false, example: 'TRX-123456' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ description: 'Payment notes', required: false, example: 'Paid in cash' })
  @IsOptional()
  @IsString()
  notes?: string;
}