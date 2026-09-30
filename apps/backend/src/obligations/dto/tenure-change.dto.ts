import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class TenureChangePreviewDto {
  @ApiProperty({ example: 12, minimum: 1, maximum: 120 })
  @IsInt()
  @Min(1)
  @Max(120)
  termMonths: number;
}

export class CreateTenureChangeRequestDto extends TenureChangePreviewDto {
  @ApiProperty({ example: 'CUSTOMER_AFFORDABILITY' })
  @IsString()
  @IsNotEmpty()
  reasonCode: string;

  @ApiPropertyOptional({ example: 'Customer requested a lower deduction.' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: 'Version returned by the obligation/preview API',
  })
  @IsInt()
  @Min(0)
  expectedObligationVersion: number;
}

export class RejectTenureChangeDto {
  @ApiProperty({ example: 'Requested term is outside approved policy.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class PenaltyAdjustmentDto {
  @ApiProperty({ example: 125050, minimum: 1 })
  @IsInt({ message: 'amountKobo must be a whole number of kobo' })
  @Min(1)
  amountKobo: number;

  @ApiProperty({ enum: ['WAIVER', 'REVERSAL'] })
  @IsIn(['WAIVER', 'REVERSAL'])
  type: 'WAIVER' | 'REVERSAL';

  @ApiProperty({ example: 'APPROVED_CUSTOMER_APPEAL' })
  @IsString()
  @IsNotEmpty()
  reasonCode: string;

  @ApiProperty({ example: 'Approved under ticket FIN-1042.' })
  @IsString()
  @IsNotEmpty()
  note: string;

  @ApiProperty({
    description: 'Current obligation version returned by the read API',
  })
  @IsInt()
  @Min(0)
  expectedObligationVersion: number;
}
