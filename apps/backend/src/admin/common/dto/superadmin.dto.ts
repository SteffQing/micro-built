import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { PayrollVariationPreviewDto } from './payroll-variation.dto';
import { Transform } from 'class-transformer';
import { VariationScheduleMode } from 'src/common/types/report.interface';

export class InviteAdminDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to receive reset instructions',
  })
  @IsEmail()
  @Transform(({ value }: { value?: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Name of admin',
  })
  @IsString()
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
  id: string;
}

export class GenerateMonthlyLoanScheduleDto extends PayrollVariationPreviewDto {
  @ApiProperty({
    description: 'Hash of the exact variation preview reviewed by the operator',
  })
  @IsString()
  @IsNotEmpty()
  previewHash: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'email to receive the report to',
  })
  @IsEmail()
  @Transform(({ value }: { value?: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  email: string;

  @ApiPropertyOptional({
    enum: VariationScheduleMode,
    default: VariationScheduleMode.DRAFT,
    description:
      'DRAFT generates a fresh, non-binding version. SUBMIT prepares an official changes-only file; actual submission must be confirmed separately.',
  })
  @IsOptional()
  @IsIn(Object.values(VariationScheduleMode))
  mode?: VariationScheduleMode;

  @ApiPropertyOptional({
    description:
      'Required for payroll submission. State why this version is being submitted or replacing an earlier version.',
  })
  @ValidateIf(
    (dto: GenerateMonthlyLoanScheduleDto) =>
      dto.mode === VariationScheduleMode.SUBMIT,
  )
  @IsString()
  @IsNotEmpty()
  submissionNote?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Legacy document-storage flag. It no longer publishes or freezes a payroll schedule.',
  })
  @IsOptional()
  @IsBoolean()
  save?: boolean;
}
