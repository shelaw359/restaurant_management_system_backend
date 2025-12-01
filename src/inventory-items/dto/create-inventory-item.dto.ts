import { IsString, IsNumber, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInventoryItemDto {
  @ApiProperty({ example: 'Cooking Oil' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  restaurantId: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 'liters' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderLevel: number;

  @ApiProperty({ example: 'Food', required: false })
  @IsOptional()
  @IsString()
  category?: string;
}