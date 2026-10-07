import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction, LoanCategory, LoanStatus, MicroLoanStatus, UserStatus } from '@prisma/client';
import { LoanFiguresDto } from 'src/common/dto/loan.dto';

// What a customer's statement / report file shows, and what GET /admin/customer/:id/report-preview
// returns. The admin-only parts are optional properties, absent (not null) on a customer's copy.

export const REPORT_AUDIENCES = ['admin', 'customer'] as const;
export type CustomerReportAudience = (typeof REPORT_AUDIENCES)[number];

export class ReportRangeDto {
  @ApiProperty({ example: '2026-06', description: 'First payroll month (YYYY-MM)' })
  from: string;

  @ApiProperty({ example: '2026-10', description: 'Last payroll month (YYYY-MM), included' })
  to: string;

  @ApiProperty({ example: 'JUNE 2026' })
  fromLabel: string;

  @ApiProperty({ example: 'OCTOBER 2026' })
  toLabel: string;
}

export class ReportCustomerDto {
  @ApiProperty({ example: 'MB-E0320S' })
  id: string;

  @ApiProperty({ example: 'Ada Obi' })
  name: string;

  @ApiProperty({ example: '1234567', nullable: true, type: String, description: 'IPPIS number' })
  externalId: string | null;

  @ApiProperty({ example: '+2348012345678', nullable: true, type: String })
  phoneNumber: string | null;

  @ApiProperty({
    example: 'ada@example.com',
    nullable: true,
    type: String,
    description: 'null when the customer signed up with a phone number only',
  })
  email: string | null;

  @ApiProperty({ example: 'NIGERIAN NAVY', nullable: true, type: String, description: 'The organization’s name' })
  organization: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The organization (GET /admin/organizations); null without a payroll record',
  })
  organizationId: string | null;

  @ApiProperty({ example: 'LAGOS', nullable: true, type: String })
  command: string | null;

  @ApiProperty({
    example: '12 Marina Road, Lagos',
    nullable: true,
    type: String,
    description: 'Residential address and state (identity details); null before they are submitted',
  })
  address: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;
}

export class ReportCommodityDto {
  @ApiProperty({ example: 'Laptop' })
  name: string;

  @ApiProperty({ example: 'HP EliteBook 840', nullable: true, type: String })
  details: string | null;

  @ApiPropertyOptional({
    example: 'Supplier: Slot, invoice 4411',
    nullable: true,
    type: String,
    description: 'Admin audience only',
  })
  privateDetails?: string | null;
}

export class ReportTopupDto {
  @ApiProperty({ example: 'cmf1k2...', description: 'Top-up (microloan) id' })
  id: string;

  @ApiProperty({ example: 50000 })
  amount: number;

  @ApiProperty({ enum: MicroLoanStatus, example: MicroLoanStatus.DISBURSED })
  status: MicroLoanStatus;

  @ApiProperty({ example: '2026-08-02T10:00:00Z' })
  requestedAt: Date;

  @ApiProperty({ example: '2026-08-04T10:00:00Z', nullable: true, type: Date })
  disbursedAt: Date | null;

  @ApiProperty({ type: ReportCommodityDto, nullable: true, description: 'An asset top-up' })
  commodity: ReportCommodityDto | null;
}

/** A loan disbursed in, or still running during, the range. */
export class ReportLoanDto extends LoanFiguresDto {
  @ApiProperty({ example: 'LN-ABC123' })
  id: string;

  @ApiProperty({ enum: LoanStatus, example: LoanStatus.DISBURSED })
  status: LoanStatus;

  @ApiProperty({ enum: LoanCategory, example: LoanCategory.PERSONAL })
  category: LoanCategory;

  @ApiProperty({ example: '2026-06-10T10:00:00Z', nullable: true, type: Date })
  disbursementDate: Date | null;

  @ApiProperty({ type: ReportCommodityDto, nullable: true, description: 'The asset of an asset loan' })
  commodity: ReportCommodityDto | null;

  @ApiProperty({ type: [ReportTopupDto], description: 'Top-ups that were not rejected, oldest first' })
  topups: ReportTopupDto[];
}

export class ReportPaymentSplitDto {
  @ApiProperty({ example: 15000 })
  principal: number;

  @ApiProperty({ example: 5000 })
  interest: number;

  @ApiProperty({ example: 0 })
  penalty: number;
}

export class ReportStatementLineDto {
  @ApiProperty({ example: '2026-06-10T10:00:00Z' })
  date: Date;

  @ApiProperty({ example: 'LN-ABC123' })
  loanId: string;

  @ApiProperty({ example: 'cmf1k2...', description: 'The microloan or repayment id' })
  reference: string;

  @ApiProperty({ enum: ['DISBURSEMENT', 'INTEREST', 'PENALTY', 'REPAYMENT'], example: 'REPAYMENT' })
  type: 'DISBURSEMENT' | 'INTEREST' | 'PENALTY' | 'REPAYMENT';

  @ApiProperty({ example: 'Payroll deduction, JULY 2026' })
  description: string;

  @ApiProperty({ example: 0 })
  debit: number;

  @ApiProperty({ example: 20000 })
  credit: number;

  @ApiProperty({ example: 100000, description: 'Running balance after this line' })
  balance: number;

  @ApiPropertyOptional({ example: 2000, description: 'Admin audience only, on a disbursement' })
  managementFee?: number;

  @ApiPropertyOptional({ type: ReportPaymentSplitDto, description: 'Admin audience only, on a repayment' })
  split?: ReportPaymentSplitDto;
}

export class ReportStatementDto {
  @ApiProperty({ example: 0, description: 'Balance before the first month of the range' })
  opening: number;

  @ApiProperty({ example: 120000 })
  debits: number;

  @ApiProperty({ example: 20000 })
  credits: number;

  @ApiProperty({ example: 100000, description: 'opening + debits − credits' })
  closing: number;

  @ApiProperty({ type: [ReportStatementLineDto] })
  lines: ReportStatementLineDto[];
}

export class ReportTotalsDto {
  @ApiProperty({ example: 20000, description: 'Paid in the range (the statement credits)' })
  repaid: number;

  @ApiProperty({ example: 100000, description: "Outstanding now, across all the customer's loans" })
  outstanding: number;

  @ApiProperty({ example: 87.5, description: 'Repayment rate (0–100) over closed payroll months' })
  repaymentRate: number;
}

/** Admin audience only: revenue booked and collected within the range (from the statement lines). */
export class ReportRevenueDto {
  @ApiProperty({ example: 20000 })
  interestBooked: number;

  @ApiProperty({ example: 5000 })
  interestCollected: number;

  @ApiProperty({ example: 2000, description: 'Kept from the cash disbursed in the range' })
  managementFee: number;

  @ApiProperty({ example: 0 })
  penaltyCharged: number;

  @ApiProperty({ example: 0 })
  penaltyCollected: number;
}

export class ReportOfficerDto {
  @ApiProperty({ example: 'AD-1M8KI4' })
  id: string;

  @ApiProperty({ example: 'Jane Admin' })
  name: string;
}

export class ReportAuditEntryDto {
  @ApiProperty({ enum: AuditAction, example: AuditAction.LOAN_DISBURSED })
  action: AuditAction;

  @ApiProperty({ example: 'Disbursed after payroll confirmation', nullable: true, type: String })
  note: string | null;

  @ApiProperty({ example: 'Jane Admin' })
  actorName: string;

  @ApiProperty({ example: '2026-06-10T10:00:00Z' })
  createdAt: Date;
}

export class ReportNotesDto {
  @ApiProperty({ example: null, nullable: true, type: String, description: 'Why the customer is flagged' })
  flagReason: string | null;

  @ApiProperty({
    type: [ReportAuditEntryDto],
    description: 'The last 20 audit entries about the customer or their loans, newest first',
  })
  history: ReportAuditEntryDto[];
}

export class CustomerReportDto {
  @ApiProperty({ enum: REPORT_AUDIENCES, example: 'admin' })
  audience: CustomerReportAudience;

  @ApiProperty({ example: '2026-10-01T09:00:00Z' })
  generatedAt: Date;

  @ApiProperty({ type: ReportRangeDto })
  range: ReportRangeDto;

  @ApiProperty({ type: ReportCustomerDto })
  customer: ReportCustomerDto;

  @ApiProperty({ type: [ReportLoanDto] })
  loans: ReportLoanDto[];

  @ApiProperty({ type: ReportStatementDto })
  statement: ReportStatementDto;

  @ApiProperty({ type: ReportTotalsDto })
  totals: ReportTotalsDto;

  @ApiPropertyOptional({ type: ReportRevenueDto, description: 'Admin audience only' })
  revenue?: ReportRevenueDto;

  @ApiPropertyOptional({ type: ReportOfficerDto, nullable: true, description: 'Admin audience only' })
  accountOfficer?: ReportOfficerDto | null;

  @ApiPropertyOptional({ type: ReportNotesDto, description: 'Admin audience only' })
  notes?: ReportNotesDto;
}
