import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../../common/enums';

export class UpdatePaymentDto {
  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.COMPLETED, required: false })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiProperty({ example: 'TXN987654321', required: false })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ example: 'Payment verified', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}