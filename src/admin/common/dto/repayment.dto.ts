import { ApiPropertyOptional } from '@nestjs/swagger';
import { RepaymentStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class FilterRepaymentsDto {
  @ApiPropertyOptional({
    enum: RepaymentStatus,
    example: RepaymentStatus.AWAITING,
  })
  @IsOptional()
  @IsEnum(RepaymentStatus)
  status?: RepaymentStatus;
}
