import { ApiProperty } from '@nestjs/swagger';

export class UnauthorizedErrorDto {
  @ApiProperty({
    example: 401,
    description: 'HTTP status code',
  })
  statusCode: number;

  @ApiProperty({
    example: 'Verification code expired',
    description: 'Error message',
  })
  message: string;

  @ApiProperty({
    example: 'Unauthorized',
    description: 'HTTP error type',
  })
  error: string;
}
