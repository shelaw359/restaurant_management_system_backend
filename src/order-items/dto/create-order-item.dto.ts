import { IsInt, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  orderId: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Type(() => Number)
  menuItemId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 'No onions, extra cheese', required: false })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}