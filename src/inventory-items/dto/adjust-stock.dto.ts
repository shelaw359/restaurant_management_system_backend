import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum StockAdjustmentType {
  ADD = 'ADD',
  SUBTRACT = 'SUBTRACT',
  SET = 'SET',
}

export class AdjustStockDto {
  @ApiProperty({ enum: StockAdjustmentType, example: StockAdjustmentType.ADD })
  @IsEnum(StockAdjustmentType)
  type: StockAdjustmentType;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 'Received from supplier', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
