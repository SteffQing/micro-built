import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class InviteAdminDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address the invite (with a first password) is sent to',
  })
  @Transform(({ value }: { value?: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Name of admin',
  })
  @Transform(({ value }: { value?: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: [AdminRole.ADMIN, AdminRole.SUPER_ADMIN, AdminRole.MARKETER],
    example: AdminRole.ADMIN,
    description: 'The role to assign the admin',
  })
  @IsIn([AdminRole.ADMIN, AdminRole.SUPER_ADMIN, AdminRole.MARKETER])
  role: AdminRole;
}

export class RemoveAdminDto {
  @ApiProperty({
    example: 'AD-1M8KI4',
    description: 'User Id of the admin to be removed',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}
