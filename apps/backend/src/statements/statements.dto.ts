import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional } from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';
import { PeriodRangeQueryDto } from 'src/common/dto/period.dto';
import type { DocumentFormat, ReportAudience } from 'src/common/types/queue.interface';

const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class StatementQueryDto extends IntersectionType(PaginatedQueryDto, PeriodRangeQueryDto) {}

/**
 * A statement or report file. `from`/`to` default to the first disbursement month and the
 * current month (Lagos).
 */
export class DocumentRequestDto extends PeriodRangeQueryDto {
  @ApiPropertyOptional({ enum: ['pdf', 'xlsx'], default: 'pdf' })
  @IsOptional()
  @IsIn(['pdf', 'xlsx'])
  format?: DocumentFormat;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: "Also email the link here; defaults to the requester's email. The link always arrives in-app.",
  })
  @IsOptional()
  @Transform(trimLower)
  @IsEmail()
  email?: string;
}

export class AdminDocumentRequestDto extends DocumentRequestDto {
  @ApiPropertyOptional({
    enum: ['admin', 'customer'],
    default: 'admin',
    description: "`customer` is exactly the customer's own copy; `admin` adds revenue, private details and notes",
  })
  @IsOptional()
  @IsIn(['admin', 'customer'])
  audience?: ReportAudience;

  @ApiPropertyOptional({
    default: false,
    description:
      'Password-protect an admin copy: it only opens with the customer ID (e.g. `MB-HOWP2`). A customer copy is ' +
      'always protected.',
  })
  @IsOptional()
  @IsBoolean()
  protect?: boolean;
}

export class ReportPreviewQueryDto extends PeriodRangeQueryDto {
  @ApiPropertyOptional({ enum: ['admin', 'customer'], default: 'admin' })
  @IsOptional()
  @IsIn(['admin', 'customer'])
  audience?: ReportAudience;
}

export class DocumentJobDto {
  @ApiProperty({ example: '1842', description: 'The queued job; the file arrives by notification (and email)' })
  jobId: string;
}
