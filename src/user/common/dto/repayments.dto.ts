import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RepaymentStatus } from '@prisma/client';
import { MAX_PAGE_LIMIT } from 'src/common/dto/generic.dto';

export class RepaymentQueryDto {
  @ApiPropertyOptional({
    enum: RepaymentStatus,
    description: 'Filter by repayment status',
    example: RepaymentStatus.AWAITING,
  })
  @IsOptional()
  @IsEnum(RepaymentStatus, {
    message: `status must be one of: ${Object.values(RepaymentStatus).join(', ')}`,
  })
  status?: RepaymentStatus;

  @ApiPropertyOptional({ type: Number, example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    type: Number,
    example: 10,
    maximum: MAX_PAGE_LIMIT,
    description: `Items per page (max ${MAX_PAGE_LIMIT})`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = 10;
}
