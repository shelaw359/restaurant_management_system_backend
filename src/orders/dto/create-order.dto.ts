import { 
  IsEnum, 
  IsInt, 
  IsOptional, 
  IsString, 
  IsArray, 
  ValidateNested,
  IsPositive,
  Min,
  ValidateIf,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '../../common/enums';

// ============================================
// RENAMED: OrderItemDto -> CreateOrderItemInOrderDto
// This avoids conflict with order-items module
// ============================================
export class CreateOrderItemInOrderDto {
  @ApiProperty({ example: 2003 })
  @IsInt()
  @IsPositive()
  menuItemId: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 50.00 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 'No onions, extra spicy' })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

export class CreateOrderDto {
  // ============================================
  // REQUIRED FIELDS
  // ============================================
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  restaurantId: number;

  @ApiProperty({ example: 6 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  waiterId: number;

  @ApiProperty({ example: 150.00 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  totalAmount: number;

  // ============================================
  // TABLE - Required ONLY for DINE_IN
  // ============================================
  @ApiPropertyOptional({ 
    example: 5,
    description: 'Required for DINE_IN orders, must be null for TAKEAWAY'
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @ValidateIf(o => o.orderType === OrderType.DINE_IN, {
    message: 'tableId is required for DINE_IN orders'
  })
  tableId?: number;

  // ============================================
  // ORDER TYPE - Required
  // ============================================
  @ApiProperty({ 
    enum: OrderType,
    example: OrderType.DINE_IN,
    description: 'DINE_IN requires tableId, TAKEAWAY must not have tableId'
  })
  @IsEnum(OrderType)
  orderType: OrderType;

  // ============================================
  // CUSTOMER INFO - Optional
  // ============================================
  @ApiPropertyOptional({ example: '0712345678' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  customerName?: string;

  // ============================================
  // PARTY SIZE - Required for DINE_IN
  // ============================================
  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  customerCount: number;

  // ============================================
  // ORDER ITEMS - Updated to use renamed DTO
  // ============================================
  @ApiProperty({ 
    type: [CreateOrderItemInOrderDto],
    example: [
      { 
        menuItemId: 2003, 
        quantity: 2, 
        price: 50.00,
        specialInstructions: 'Extra spicy' 
      },
      { 
        menuItemId: 2005, 
        quantity: 1, 
        price: 30.00,
        specialInstructions: '' 
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemInOrderDto)
  items: CreateOrderItemInOrderDto[];

  // ============================================
  // NOTES - Optional
  // ============================================
  @ApiPropertyOptional({ example: 'Customer celebrating birthday' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============================================
// SEPARATE DTOs: For Frontend to use
// ============================================
export class CreateDineInOrderDto extends CreateOrderDto {
  @ApiProperty({ 
    example: 5,
    description: 'Required for dine-in orders'
  })
  @IsInt()
  @IsPositive()
  declare tableId: number;

  orderType: OrderType.DINE_IN = OrderType.DINE_IN;
}

export class CreateTakeawayOrderDto extends CreateOrderDto {
  orderType: OrderType.TAKEAWAY = OrderType.TAKEAWAY;
}