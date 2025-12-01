import {
  IsInt,
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderType } from '../../common/enums';
import { CreateOrderItemDto } from '../../order-items/dto/create-order-item.dto';

export class CreateOrderDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  restaurantId: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  tableId?: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  waiterId: number;

  @ApiProperty({ example: '0712345678', required: false })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({ example: 4, required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  customerCount?: number;

  @ApiProperty({ enum: OrderType, example: OrderType.DINE_IN })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({ example: 'Birthday celebration', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
