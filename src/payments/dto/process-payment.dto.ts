// src/payments/dto/process-payment.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../../common/enums';

export class ProcessPaymentDto {
  @ApiProperty({ 
    enum: PaymentMethod, 
    description: 'Payment method',
    example: PaymentMethod.CASH
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ 
    required: false, 
    description: 'Transaction ID from payment gateway' 
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ 
    required: false, 
    description: 'Any payment notes' 
  })
  @IsOptional()
  @IsString()
  notes?: string;
}