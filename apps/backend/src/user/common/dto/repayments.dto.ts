import { IntersectionType } from '@nestjs/swagger';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';
import { PeriodRangeQueryDto } from 'src/common/dto/period.dto';

/** `?from=2026-01&to=2026-06&page=1&limit=20`: payroll months (YYYY-MM), both optional and inclusive. */
export class UserRepaymentsQueryDto extends IntersectionType(PaginatedQueryDto, PeriodRangeQueryDto) {}
