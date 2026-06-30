import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Max } from 'class-validator';

export const MAX_PAGE_LIMIT = 500;

export class MetaDto {
  @ApiProperty({ example: 35 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class BaseResponseDto<T> {
  @ApiProperty({ description: 'Returned data', nullable: true })
  data: T;

  @ApiProperty({
    example: 'Request was successful',
    description: 'A message describing the response',
  })
  message: string;

  constructor(data: T, message: string) {
    this.data = data;
    this.message = message;
  }
}

export class PaginatedResponseDto<T> extends BaseResponseDto<T> {
  @ApiProperty({ type: MetaDto, description: 'Pagination metadata' })
  meta: MetaDto;

  constructor(data: T, message: string, meta: MetaDto) {
    super(data, message);
    this.meta = meta;
  }
}

export class PaginatedQueryDto {
  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Page number for pagination (starts from 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    maximum: MAX_PAGE_LIMIT,
    description: `Number of items to return per page (max ${MAX_PAGE_LIMIT})`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(MAX_PAGE_LIMIT)
  limit?: number = 20;
}
