// response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

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
