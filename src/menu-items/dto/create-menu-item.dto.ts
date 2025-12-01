import {
  IsString,
  IsInt,
  IsDecimal,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Grilled Chicken' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Tender grilled chicken with spices', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 850 })
  @Type(() => Number)
  price: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  categoryId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  restaurantId: number;

  @ApiProperty({ example: 15, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  prepTime?: number;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;
}
