import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChangeRequestKind, ChangeRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';

export class OwnChangeRequestsQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ enum: ChangeRequestStatus, description: 'Only requests in this state (all when absent)' })
  @IsOptional()
  @IsEnum(ChangeRequestStatus)
  status?: ChangeRequestStatus;
}

export class ChangeRequestsQueryDto extends OwnChangeRequestsQueryDto {
  @ApiPropertyOptional({ enum: ChangeRequestKind })
  @IsOptional()
  @IsEnum(ChangeRequestKind)
  kind?: ChangeRequestKind;

  @ApiPropertyOptional({ example: 'MB-7Q2LX', description: 'Only this user’s requests' })
  @IsOptional()
  @IsString()
  userId?: string;
}

export class RejectChangeRequestDto {
  @ApiPropertyOptional({ example: 'The account name does not match your BVN', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class ChangeRequestPersonDto {
  @ApiProperty({ example: 'MB-7Q2LX' })
  id: string;

  @ApiProperty({ example: 'Ada Obi' })
  name: string;
}

class ChangeRequestUserDto extends ChangeRequestPersonDto {
  @ApiProperty({ example: 'CUSTOMER', description: 'CUSTOMER or the admin’s role' })
  role: string;
}

export class ChangeRequestDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ChangeRequestKind })
  kind: ChangeRequestKind;

  @ApiProperty({ enum: ChangeRequestStatus })
  status: ChangeRequestStatus;

  @ApiProperty({ type: ChangeRequestUserDto, description: 'Whose details change' })
  user: ChangeRequestUserDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { accountNumber: '0123456789', bankName: 'Kuda MFB' },
    description:
      'Only the fields being changed, with their new values. IDENTITY: CreateIdentityDto fields; PAYMENT_METHOD: ' +
      'CreatePaymentMethodDto fields; PROFILE: name, email, phoneNumber (a photo changes at once).',
  })
  proposed: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { accountNumber: '9876543210', bankName: 'Access Bank' },
    description: 'The same fields as they were when the change was asked for',
  })
  previous: Record<string, unknown>;

  @ApiProperty({ type: ChangeRequestPersonDto, nullable: true })
  decidedBy: ChangeRequestPersonDto | null;

  @ApiProperty({ nullable: true, type: Date })
  decidedAt: Date | null;

  @ApiProperty({ nullable: true, type: String, description: 'The decider’s note (a rejection’s reason)' })
  note: string | null;

  @ApiProperty({ description: 'Admin lists only: whether the caller may approve or reject it' })
  canDecide: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ description: 'Last time the request changed (a later edit folds into a pending one)' })
  updatedAt: Date;
}
