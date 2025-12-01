import { IsString, IsInt, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CheckAvailabilityDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  restaurantId: number;

  @ApiProperty({ example: '2024-12-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '19:00' })
  @IsString()
  time: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  guestsCount: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  duration: number;
}