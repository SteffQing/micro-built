import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class VerifyCodeBodyDto {
  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @Length(6, 6)
  code: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class VerifyCodeResponseDto {
  @ApiProperty({
    example: 'User successfully verified',
    description: 'Confirmation message',
  })
  message: string;

  @ApiProperty({
    example: 'MB123456',
    description: 'ID of the verified user',
  })
  userId: string;
}
