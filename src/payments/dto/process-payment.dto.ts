import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../../common/enums';

export class ProcessPaymentDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CARD })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ example: 'TXN123456789', required: false })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ example: 'Paid with Visa ending in 4242', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}