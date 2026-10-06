import { ApiProperty } from '@nestjs/swagger';
import { LiquidationHistoryItemDto } from 'src/liquidations/liquidations.dto';
import {
  AuditAction,
  DeductionStatus,
  LoanCategory,
  LoanStatus,
  PaymentInflowSource,
  PaymentInflowState,
} from '@prisma/client';
import { LoanFiguresDto } from 'src/common/dto';
import { VARIATION_ACTIONS, VARIATION_REASONS } from '../dto/payroll-variation.dto';
import type { VariationAction, VariationReason } from 'src/ledger/variation';

// ── Overview ────────────────────────────────────────────────────────────────

export class RepaymentAmountCountDto {
  @ApiProperty({ example: 45000 })
  amount: number;

  @ApiProperty({ example: 3 })
  count: number;
}

export class InflowSourceTotalsDto {
  @ApiProperty({ example: 1200000 })
  PAYROLL: number;

  @ApiProperty({ example: 150000 })
  LIQUIDATION: number;

  @ApiProperty({ example: 0, description: 'What imported loans had repaid before they came over' })
  IMPORT: number;
}

export class InflowsReceivedDto extends RepaymentAmountCountDto {
  @ApiProperty({ type: InflowSourceTotalsDto })
  bySource: InflowSourceTotalsDto;
}

export class RepaymentsAppliedDto extends RepaymentAmountCountDto {
  @ApiProperty({ example: 1000000 })
  principal: number;

  @ApiProperty({ example: 340000 })
  interest: number;

  @ApiProperty({ example: 10000 })
  penalty: number;
}

export class RepaymentOverviewDto {
  @ApiProperty({ example: 'JANUARY 2026', description: 'First payroll month counted' })
  from: string;

  @ApiProperty({ example: 'JUNE 2026', description: 'Last payroll month counted' })
  to: string;

  @ApiProperty({ example: 1500000, description: 'Σ deductions sent to payroll for these months' })
  expected: number;

  @ApiProperty({ example: 1350000, description: 'Σ payroll payments applied to those deductions' })
  collected: number;

  @ApiProperty({ example: 150000, description: 'Σ shortfall of short (PARTIAL) and missed (FAILED) deductions' })
  overdue: number;

  @ApiProperty({ type: RepaymentAmountCountDto, description: 'PARTIAL deductions: amount = Σ their shortfall' })
  underpaid: RepaymentAmountCountDto;

  @ApiProperty({ type: RepaymentAmountCountDto, description: 'FAILED deductions (nothing arrived): amount = Σ expected' })
  failed: RepaymentAmountCountDto;

  @ApiProperty({ example: 'JULY 2026', description: 'The current payroll month (Lagos)' })
  currentPeriod: string;

  @ApiProperty({ example: 260000, description: 'Σ deductions sent to payroll for the current month and still awaited' })
  expectingThisPeriod: number;

  @ApiProperty({
    type: InflowsReceivedDto,
    description: 'Money received for these months (payroll rows, liquidations, imports; rejected ones excluded)',
  })
  received: InflowsReceivedDto;

  @ApiProperty({
    type: RepaymentsAppliedDto,
    description: 'Of that money, what was applied to loans, split into principal, interest and penalty',
  })
  applied: RepaymentsAppliedDto;

  @ApiProperty({
    type: RepaymentAmountCountDto,
    description: 'Money received, any month, still waiting on an admin (UNMATCHED, AWAITING or REVIEWING)',
  })
  unresolved: RepaymentAmountCountDto;
}

// ── List and detail ─────────────────────────────────────────────────────────

export class RepaymentCustomerDto {
  @ApiProperty({ example: 'MB-HOWP2' })
  id: string;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ example: '123456', nullable: true, type: String, description: 'IPPIS number' })
  externalId: string | null;
}

export class RepaymentPeriodDto {
  @ApiProperty({ example: '2026-06', description: 'YYYY-MM' })
  ym: string;

  @ApiProperty({ example: 'JUNE 2026' })
  label: string;
}

/** One row of GET /admin/repayments/deductions: what a loan is expected to pay for a payroll month. */
export class DeductionListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'LN-4KD8QZ' })
  loanId: string;

  @ApiProperty({ type: RepaymentPeriodDto })
  period: RepaymentPeriodDto;

  @ApiProperty({ type: RepaymentCustomerDto })
  customer: RepaymentCustomerDto;

  @ApiProperty({ example: 25000, description: 'What payroll was asked to deduct' })
  expected: number;

  @ApiProperty({ example: 20000, description: 'Σ payments applied to this deduction' })
  paid: number;

  @ApiProperty({ example: 5000, description: 'expected - paid, never below 0' })
  outstanding: number;

  @ApiProperty({ enum: DeductionStatus, example: DeductionStatus.PARTIAL })
  status: DeductionStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  settledAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the shortfall was penalised' })
  penalizedAt: Date | null;
}

/** One row of GET /admin/repayments/applied: a payment applied to a loan (a Repayment). */
/** A payment applied to a deduction, split like the statement. */
export class DeductionPaymentDto {
  @ApiProperty({ description: 'The repayment (applied payment)' })
  id: string;

  @ApiProperty({ description: 'The inflow it came from' })
  paymentInflowId: string;

  @ApiProperty({ enum: PaymentInflowSource, example: PaymentInflowSource.PAYROLL })
  source: PaymentInflowSource;

  @ApiProperty({ example: 25000 })
  amount: number;

  @ApiProperty({ example: 20833.33 })
  principal: number;

  @ApiProperty({ example: 4166.67 })
  interest: number;

  @ApiProperty({ example: 0 })
  penalty: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/**
 * How an OPEN deduction's amount is worked out right now: what is still owed beyond the months already
 * sent to payroll, spread over the months left (the last month takes the whole remainder).
 */
export class DeductionCalculationDto {
  @ApiProperty({ example: 313775, description: 'Principal + interest + penalties booked on the loan' })
  owed: number;

  @ApiProperty({ example: 57050, description: 'Everything applied to the loan so far' })
  repaid: number;

  @ApiProperty({ example: 256725, description: 'owed − repaid' })
  outstanding: number;

  @ApiProperty({ example: 0, description: 'Already sent to payroll and awaiting the file (AWAITING deductions)' })
  committed: number;

  @ApiProperty({ example: 256725, description: 'outstanding − committed, never below 0' })
  toSpread: number;

  @ApiProperty({ example: 8, description: 'Current tenure in months' })
  tenure: number;

  @ApiProperty({ example: 0, description: 'Months already sent to payroll (deductions no longer OPEN)' })
  monthsSent: number;

  @ApiProperty({ example: 8, description: 'tenure − monthsSent, at least 1' })
  remainingMonths: number;

  @ApiProperty({ example: 32090.63, description: 'toSpread ÷ remainingMonths (the whole of it in the last month)' })
  amount: number;

  @ApiProperty({ example: false, description: 'The loan is no longer running, so the deduction is 0 (a STOP row)' })
  stopped: boolean;
}

export class DeductionDetailDto extends DeductionListItemDto {
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: [DeductionPaymentDto], description: 'Payments applied to this deduction, oldest first' })
  payments: DeductionPaymentDto[];

  @ApiProperty({
    type: DeductionCalculationDto,
    nullable: true,
    description:
      'OPEN only: the live calculation. Once the month is sent to payroll the amount is frozen, so this is null.',
  })
  calculation: DeductionCalculationDto | null;
}

export class AppliedRepaymentListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'LN-4KD8QZ' })
  loanId: string;

  @ApiProperty({ description: 'The payment received (PaymentInflow) it came from' })
  paymentInflowId: string;

  @ApiProperty({ enum: PaymentInflowSource, example: PaymentInflowSource.PAYROLL })
  source: PaymentInflowSource;

  @ApiProperty({ type: RepaymentPeriodDto, description: 'Payroll month of the payment' })
  period: RepaymentPeriodDto;

  @ApiProperty({ type: RepaymentCustomerDto })
  customer: RepaymentCustomerDto;

  @ApiProperty({ example: 25000 })
  amount: number;

  @ApiProperty({ example: 20833.33 })
  principal: number;

  @ApiProperty({ example: 4166.67 })
  interest: number;

  @ApiProperty({ example: 0 })
  penalty: number;

  @ApiProperty({ type: String, nullable: true, description: 'The deduction it settled, if any' })
  deductionId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

/** One row of GET /admin/repayments/inflows: money received (a PaymentInflow). */
export class RepaymentListItemDto {
  @ApiProperty({ example: 'cmb2x0k1p0000abcd1234efgh' })
  id: string;

  @ApiProperty({ enum: PaymentInflowSource, example: PaymentInflowSource.PAYROLL })
  source: PaymentInflowSource;

  @ApiProperty({
    enum: PaymentInflowState,
    example: PaymentInflowState.SETTLED,
    description:
      'UNMATCHED: no customer has the staff ID. AWAITING: a liquidation waiting for a decision. ' +
      'REVIEWING: needs an admin (no live loan, no deduction that month, or paid more than owed). ' +
      'SETTLED / REJECTED: done.',
  })
  state: PaymentInflowState;

  @ApiProperty({ example: 25000, description: 'Amount received' })
  amount: number;

  @ApiProperty({ example: 25000, description: 'Amount applied to the loan (0 until it is)' })
  applied: number;

  @ApiProperty({ example: 'JUNE 2026', description: 'Payroll month' })
  period: string;

  @ApiProperty({ type: RepaymentCustomerDto, nullable: true, description: 'Null for an unmatched payroll row' })
  customer: RepaymentCustomerDto | null;

  @ApiProperty({ example: '123456', nullable: true, type: String, description: "The payroll sheet's staff ID" })
  externalUserId: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'The payroll upload the row came from' })
  uploadId: string | null;

  @ApiProperty({ example: false, description: 'A liquidation with proof of payment (GET :id/proof)' })
  hasProof: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class RepaymentDetailCustomerDto extends RepaymentCustomerDto {
  @ApiProperty({ example: 'jane@example.com', nullable: true, type: String })
  email: string | null;

  @ApiProperty({ example: '+2348012345678', nullable: true, type: String })
  phoneNumber: string | null;
}

export class RepaymentAppliedDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'LN-4KD8QZ' })
  loanId: string;

  @ApiProperty({ example: 25000, description: 'Applied to the loan' })
  amount: number;

  @ApiProperty({ example: 20833.33 })
  principal: number;

  @ApiProperty({ example: 4166.67 })
  interest: number;

  @ApiProperty({ example: 0 })
  penalty: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class RepaymentDeductionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'JUNE 2026' })
  period: string;

  @ApiProperty({ example: 25000, description: 'What payroll was asked to deduct' })
  expected: number;

  @ApiProperty({ example: 25000, description: 'Σ payments applied to it' })
  paid: number;

  @ApiProperty({ enum: DeductionStatus, example: DeductionStatus.FULFILLED })
  status: DeductionStatus;

  @ApiProperty({
    example: true,
    description: "True when this payment settled it; false when it is the month's deduction APPLY would settle",
  })
  settledByThis: boolean;
}

export class RepaymentLoanDto extends LoanFiguresDto {
  @ApiProperty({ example: 'LN-4KD8QZ' })
  id: string;

  @ApiProperty({ enum: LoanCategory })
  category: LoanCategory;

  @ApiProperty({ enum: LoanStatus })
  status: LoanStatus;
}

export class RepaymentHistoryEntryDto {
  @ApiProperty({ enum: AuditAction, example: AuditAction.PAYMENT_INFLOW_APPROVED })
  action: AuditAction;

  @ApiProperty({ nullable: true, type: String })
  note: string | null;

  @ApiProperty({ example: 'AD-1M8KI4' })
  actorId: string;

  @ApiProperty({ example: 'John Admin', nullable: true, type: String })
  actorName: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class RepaymentDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: PaymentInflowSource })
  source: PaymentInflowSource;

  @ApiProperty({ enum: PaymentInflowState })
  state: PaymentInflowState;

  @ApiProperty({ example: 27500, description: 'Amount received' })
  amount: number;

  @ApiProperty({ example: 25000, description: 'Applied to the loan' })
  applied: number;

  @ApiProperty({ example: 2500, description: 'Received but not applied: to refund, or still to resolve' })
  unapplied: number;

  @ApiProperty({ example: 'JUNE 2026' })
  period: string;

  @ApiProperty({ example: '123456', nullable: true, type: String })
  externalUserId: string | null;

  @ApiProperty({ nullable: true, type: String })
  uploadId: string | null;

  @ApiProperty()
  hasProof: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: RepaymentDetailCustomerDto, nullable: true })
  customer: RepaymentDetailCustomerDto | null;

  @ApiProperty({ type: RepaymentAppliedDto, nullable: true, description: 'What was applied, split by component' })
  repayment: RepaymentAppliedDto | null;

  @ApiProperty({ type: RepaymentDeductionDto, nullable: true })
  deduction: RepaymentDeductionDto | null;

  @ApiProperty({
    type: RepaymentLoanDto,
    nullable: true,
    description: "The loan paid into, or else the customer's live (or latest) loan",
  })
  loan: RepaymentLoanDto | null;

  @ApiProperty({ type: [RepaymentHistoryEntryDto], description: 'Admin decisions on this payment, oldest first' })
  history: RepaymentHistoryEntryDto[];
}

// ── Decisions ───────────────────────────────────────────────────────────────

export class ManualResolutionResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: PaymentInflowState, example: PaymentInflowState.SETTLED })
  state: PaymentInflowState;

  @ApiProperty({ example: 'MB-HOWP2', nullable: true, type: String })
  customerId: string | null;

  @ApiProperty({ example: 'LN-4KD8QZ', nullable: true, type: String, description: 'Set when the money was applied' })
  loanId: string | null;

  @ApiProperty({ example: 25000 })
  applied: number;

  @ApiProperty({ example: 0, description: 'Received beyond what was owed: to refund, then SETTLE' })
  unapplied: number;

  @ApiProperty({ enum: DeductionStatus, nullable: true, description: "The month's deduction, when it was settled" })
  deductionStatus: DeductionStatus | null;
}

export class LiquidationDecisionResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'MB-HOWP2' })
  customerId: string;

  @ApiProperty({ enum: PaymentInflowState, example: PaymentInflowState.SETTLED })
  state: PaymentInflowState;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ example: 150000, nullable: true, type: Number, description: 'Applied to the loan (null if rejected)' })
  applied: number | null;

  @ApiProperty({ example: 0, nullable: true, type: Number, description: 'Left on the loan afterwards (null if rejected)' })
  outstanding: number | null;
}

export class SignedFileUrlDto {
  @ApiProperty({ example: 'https://…supabase.co/storage/v1/object/sign/…' })
  url: string;

  @ApiProperty({ example: 300, description: 'Seconds the link stays valid' })
  expiresIn: number;
}

export class PeriodCloseErrorDto {
  @ApiProperty()
  deductionId: string;

  @ApiProperty()
  message: string;
}

export class PeriodCloseSummaryDto {
  @ApiProperty()
  periodId: string;

  @ApiProperty({ example: 'JUNE 2026' })
  label: string;

  @ApiProperty({ description: 'False when some deductions failed to close: run the close again (done rows are skipped)' })
  closed: boolean;

  @ApiProperty({ example: 4, description: 'Settled without a penalty (loan repaid, or nothing was due)' })
  settled: number;

  @ApiProperty({ example: 2, description: 'Nothing arrived' })
  failed: number;

  @ApiProperty({ example: 1, description: 'Less than expected arrived' })
  partial: number;

  @ApiProperty({ example: 3 })
  penalties: number;

  @ApiProperty({ example: 4500 })
  penaltyTotal: number;

  @ApiProperty({ example: 1, description: 'Tenure extensions proposed because the monthly amount broke the cap' })
  proposals: number;

  @ApiProperty({ type: [PeriodCloseErrorDto] })
  errors: PeriodCloseErrorDto[];
}

/** A customer's liquidation requests (GET /admin/customer/:id/liquidation-requests). */
export class CustomerLiquidationRequestsDto extends LiquidationHistoryItemDto {}

// ── Payroll variations ──────────────────────────────────────────────────────

export class VariationPeriodStateDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'JUNE 2026' })
  label: string;

  @ApiProperty({ example: '2026-06' })
  ym: string;

  @ApiProperty({ nullable: true, type: String, format: 'date-time', description: 'When it went to payroll' })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  closedAt: Date | null;

  @ApiProperty({ description: 'The submitted file can be downloaded (GET /admin/payroll-variations/file)' })
  hasFile: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'A payroll file has been uploaded for OCTOBER 2026',
    description: 'Why the submission cannot be reverted; null when it can (always null before it is submitted)',
  })
  revertBlockedBy: string | null;
}

export class VariationRowDto {
  @ApiProperty({ example: 'LN-4KD8QZ' })
  loanId: string;

  @ApiProperty({ example: 'MB-HOWP2' })
  customerId: string;

  @ApiProperty({ example: '123456', nullable: true, type: String, description: 'IPPIS number' })
  externalId: string | null;

  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ example: 'Lagos', nullable: true, type: String })
  command: string | null;

  @ApiProperty({ example: 90000, description: 'Outstanding on the loan' })
  balance: number;

  @ApiProperty({ example: 22500, description: 'The new monthly deduction (0 = stop)' })
  amount: number;

  @ApiProperty({ example: 4, description: 'Months left to deduct (0 on a STOP)' })
  tenure: number;

  @ApiProperty({ enum: VARIATION_ACTIONS, example: 'AMEND' })
  action: VariationAction;

  @ApiProperty({ enum: VARIATION_REASONS, isArray: true, example: ['TOPUP'] })
  reasons: VariationReason[];

  @ApiProperty({ example: '01/06/2026', description: 'dd/MM/yyyy' })
  start: string;

  @ApiProperty({ example: '30/09/2026', description: 'dd/MM/yyyy' })
  end: string;
}

export class VariationCountsDto {
  @ApiProperty({ example: 3 })
  START: number;

  @ApiProperty({ example: 5 })
  AMEND: number;

  @ApiProperty({ example: 1 })
  STOP: number;
}

export class VariationPreviewDto {
  @ApiProperty({ type: VariationPeriodStateDto })
  period: VariationPeriodStateDto;

  @ApiProperty({ type: [VariationRowDto], description: 'After the action/reason filter' })
  rows: VariationRowDto[];

  @ApiProperty({ type: VariationCountsDto, description: 'Over every row, before the filter' })
  counts: VariationCountsDto;
}

export class VariationDraftQueuedDto {
  @ApiProperty({ example: 'JUNE 2026' })
  period: string;

  @ApiProperty({ example: 'payroll@example.com' })
  email: string;
}

export class VariationRevertResultDto {
  @ApiProperty()
  periodId: string;

  @ApiProperty({ example: 'OCTOBER 2026' })
  period: string;

  @ApiProperty({ example: 120, description: 'Deductions reopened (back to OPEN, recomputed)' })
  reopened: number;

  @ApiProperty({ example: 118, description: "Next month's OPEN deductions the submit had opened, removed" })
  removed: number;
}

export class VariationSubmitResultDto {
  @ApiProperty()
  periodId: string;

  @ApiProperty({ example: 'JUNE 2026' })
  period: string;

  @ApiProperty({ type: VariationCountsDto })
  counts: VariationCountsDto;

  @ApiProperty({ example: 120, description: "Deductions frozen at the file's amounts" })
  frozen: number;

  @ApiProperty({ example: 118, description: "Next month's deductions opened" })
  opened: number;
}

export class VariationOpenPeriodDto {
  @ApiProperty({ example: '2026-11' })
  ym: string;

  @ApiProperty({ example: 'NOVEMBER 2026' })
  label: string;
}
