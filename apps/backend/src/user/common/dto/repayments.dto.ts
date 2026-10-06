import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { PaymentInflowSource } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';
import { PeriodRangeQueryDto } from 'src/common/dto/period.dto';

/** `?from=2026-01&to=2026-06&page=1&limit=20`: payroll months (YYYY-MM), both optional and inclusive. */
export class UserRepaymentsQueryDto extends IntersectionType(PaginatedQueryDto, PeriodRangeQueryDto) {}

/** `?source=PAYROLL&page=1&limit=20` */
export class UserInflowsQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ enum: PaymentInflowSource })
  @IsOptional()
  @IsEnum(PaymentInflowSource)
  source?: PaymentInflowSource;
}
