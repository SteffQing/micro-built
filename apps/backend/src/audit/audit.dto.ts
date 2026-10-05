import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction, AuditEntityType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'Use a date like 2026-10-05';

export class AuditQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ example: 'admin-1', description: 'Only what this admin did' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ enum: AuditEntityType })
  @IsOptional()
  @IsEnum(AuditEntityType)
  entityType?: AuditEntityType;

  @ApiPropertyOptional({ example: 'MB-7Q2LX', description: 'Only entries about this record (a user, loan, …)' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'First day (Lagos time), inclusive' })
  @IsOptional()
  @Matches(DAY, { message: DAY_MESSAGE })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-05', description: 'Last day (Lagos time), inclusive' })
  @IsOptional()
  @Matches(DAY, { message: DAY_MESSAGE })
  to?: string;
}

class AuditActorDto {
  @ApiProperty({ example: 'admin-1' })
  id: string;

  @ApiProperty({ example: 'Ada Obi' })
  name: string;

  @ApiProperty({ example: 'SUPER_ADMIN', description: 'The admin’s role; SYSTEM for automatic actions' })
  role: string;
}

export class AuditEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AuditAction })
  action: AuditAction;

  @ApiProperty({ enum: AuditEntityType })
  entityType: AuditEntityType;

  @ApiProperty({ example: 'MB-7Q2LX' })
  entityId: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'John Doe',
    description: 'Who the record belongs to, when that is a person: the user (USER) or the borrower (LOAN)',
  })
  entityLabel: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'Platform → Ada Obi' })
  note: string | null;

  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    example: { before: { interestRate: 0.06 }, after: { interestRate: 0.065 } },
    description: 'Structured detail (e.g. a settings change’s before and after, an export’s filters)',
  })
  meta: Record<string, unknown> | null;

  @ApiProperty({ type: AuditActorDto })
  actor: AuditActorDto;

  @ApiProperty()
  createdAt: Date;
}
