import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class AdminListDto {
  @ApiProperty({
    example: 'abc123',
    description: 'Unique identifier of the admin user',
  })
  id: string;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    description: "URL of the admin user's avatar",
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full name of the admin user',
  })
  name: string;

  @ApiProperty({ enum: UserRole, description: 'Role of the admin user' })
  role: UserRole;

  @ApiProperty({
    example: 'jane@example.com',
    description: 'Email address of the admin user',
  })
  email: string;

  @ApiProperty({
    enum: UserStatus,
    description: 'Account status of the admin user',
  })
  status: UserStatus;
}
