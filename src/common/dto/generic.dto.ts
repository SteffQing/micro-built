import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetaDto {
  @ApiProperty({ example: 35 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class ResponseDto<T> {
  @ApiProperty({ description: 'Response data' })
  data: T;

  @ApiProperty({
    example: 'Request was successful',
    description: 'Response message',
  })
  message: string;

  @ApiPropertyOptional({
    type: MetaDto,
    description: 'Pagination meta data (if applicable)',
  })
  meta?: MetaDto;
}
