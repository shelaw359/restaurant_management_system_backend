import {
  IsString,
  IsInt,
  IsEmail,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  restaurantId: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Type(() => Number)
  tableId: number;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  customerName: string;

  @ApiProperty({ example: '0712345678' })
  @IsString()
  customerPhone: string;

  @ApiProperty({ example: 'john@example.com', required: false })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty({ example: '2024-12-15' })
  @IsDateString()
  reservationDate: string;

  @ApiProperty({ example: '19:00' })
  @IsString()
  reservationTime: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  guestsCount: number;

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  duration?: number;

  @ApiProperty({ example: 'Birthday celebration', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}