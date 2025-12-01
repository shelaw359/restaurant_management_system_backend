import { IsInt, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateOrderItemDto {
  @ApiProperty({ example: 3, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity?: number;

  @ApiProperty({ example: 'Extra spicy', required: false })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}