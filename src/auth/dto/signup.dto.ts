import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length, MinLength } from 'class-validator';

export class SignupDto {
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
