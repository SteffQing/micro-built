import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PayrollVariationFilter } from 'src/common/types/report.interface';
import { PeriodDto } from './repayment.dto';

export class PayrollVariationPreviewDto extends PeriodDto {
  @ApiPropertyOptional({
    enum: PayrollVariationFilter,
    default: PayrollVariationFilter.ALL,
    description:
      'Select customers by unsubmitted effective loan changes. COMBINED requires top-up, liquidation and approved tenure change for the same customer.',
  })
  @IsOptional()
  @IsEnum(PayrollVariationFilter)
  changeFilter?: PayrollVariationFilter;
}
