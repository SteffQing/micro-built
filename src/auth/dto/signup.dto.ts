// dto/signup.dto.ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SignupDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsNotEmpty() password: string;
  @IsString() phone: string;
}
