import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenureChangeReason, TenureChangeStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, NotEquals } from 'class-validator';
import { PaginatedQueryDto } from 'src/common/dto/generic.dto';

export class TenureChangeQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ enum: TenureChangeStatus, description: 'Only changes in this state (all when absent)' })
  @IsOptional()
  @IsEnum(TenureChangeStatus)
  status?: TenureChangeStatus;
}

export class ProposeTenureChangeDto {
  @ApiProperty({ example: 2, description: 'Months to add to the tenure; negative shortens it' })
  @Type(() => Number)
  @IsInt()
  @NotEquals(0, { message: 'monthsDelta must not be 0' })
  @Min(-120)
  @Max(120)
  monthsDelta: number;

  @ApiPropertyOptional({ default: false, description: 'Approve it at once instead of leaving it pending' })
  @IsOptional()
  @IsBoolean()
  apply?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Lengthening only (400 otherwise): when applied, also book interest for the added months on the principal ' +
      'still owed (principal left × monthly rate × months). Off: the tenure moves and what is owed stays.',
  })
  @IsOptional()
  @IsBoolean()
  reprice?: boolean;
}

export class RejectTenureChangeDto {
  @ApiPropertyOptional({ example: 'Customer will clear the arrears this month', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class PersonRefDto {
  @ApiProperty({ example: 'MB-7Q2LX' })
  id: string;

  @ApiProperty({ example: 'Ada Obi' })
  name: string;
}

export class TenureChangeItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'LN-4KX9Q2' })
  loanId: string;

  @ApiProperty({ type: PersonRefDto })
  customer: PersonRefDto;

  @ApiProperty({ enum: TenureChangeReason })
  reason: TenureChangeReason;

  @ApiProperty({ enum: TenureChangeStatus })
  status: TenureChangeStatus;

  @ApiProperty({ example: 2, description: 'Signed: negative shortens the loan' })
  monthsDelta: number;

  @ApiProperty({ example: 6, description: 'The tenure when the change was proposed (when approved: just before it)' })
  previousTenure: number;

  @ApiProperty({ example: 8, description: "The loan's tenure now" })
  loanTenure: number;

  @ApiProperty({ type: PersonRefDto, nullable: true, description: 'null: the system proposed it after a default' })
  requestedBy: PersonRefDto | null;

  @ApiProperty({ nullable: true, type: String, description: 'The top-up it was requested with (decided with it)' })
  topupId: string | null;

  @ApiProperty({ example: false, description: 'Books interest for the added months when applied' })
  reprice: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 3000,
    description: 'Repriced and applied: the interest booked. Pending: what it would book now. Otherwise null',
  })
  interestAdded: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true, type: Date })
  decidedAt: Date | null;

  @ApiProperty({ nullable: true, type: String, description: "The decider's note (a rejection's reason)" })
  note: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 200000, description: "Customer's net pay (payroll)" })
  netPay: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 20000,
    description: 'Largest monthly deduction allowed: net pay × Settings.maxDeductionRate (null when either is unset)',
  })
  cap: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 26150, description: 'Monthly deduction now (pending changes)' })
  currentMonthly: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 17433.33,
    description: 'Monthly deduction if approved (pending changes)',
  })
  proposedMonthly: number | null;
}
