import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length, MinLength } from 'class-validator';

export class SignupBodyDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123$$' })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '09033367605' })
  @IsNotEmpty()
  @Length(11, 11)
  contact: string;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  name: string;
}

export class SignupResponseDto {
  @ApiProperty({
    example: 'Signup successful. Verification code sent to your email.',
    description: 'Confirmation message',
  })
  message: string;

  @ApiProperty({
    example: 'MB123456',
    description: 'Unique ID of the newly created user',
  })
  userId: string;
}
