import { IsString, IsInt, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TableStatus } from '../../common/enums';

export class CreateTableDto {
  @ApiProperty({ example: 'T-01' })
  @IsString()
  tableNumber: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  restaurantId: number;

  @ApiProperty({ example: 'Main Hall', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ enum: TableStatus, example: TableStatus.AVAILABLE, required: false })
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;
}
