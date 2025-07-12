import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RepaymentStatus } from '@prisma/client';

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
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;
}
