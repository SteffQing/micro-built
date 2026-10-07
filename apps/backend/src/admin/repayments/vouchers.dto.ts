import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { YM_PATTERN } from 'src/common/dto/period.dto';
import type {
  EarlierUnlocked,
  OrganizationRef,
  PayrollRowIssue,
  VoucherIssueCounts,
  VoucherReceipt,
  VoucherReport,
} from 'src/common/types/repayment.interface';

const trim = ({ value }: { value?: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Requests and responses of POST /admin/vouchers, /validate and DELETE /admin/vouchers/:id, and of the
// No payroll routes (PLAN_V2 §2).

/** The text fields beside the `file` of a voucher upload or check. */
export class VoucherBodyDto {
  @ApiProperty({ example: 'cmb2x0k1p0000abcd1234efgh', description: 'The organization the voucher is for (GET /admin/organizations)' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Choose the organization this voucher is for' })
  organizationId: string;

  @ApiPropertyOptional({ example: '2026-06', description: "The month the sheet must be for (YYYY-MM); it is read from the sheet's Period column" })
  @IsOptional()
  @Matches(YM_PATTERN, { message: 'period must be a month as YYYY-MM' })
  period?: string;
}

/** `{ "reason": "…" }`: why a voucher is reverted, or why a month has no payroll. Kept in the audit log. */
export class ReasonDto {
  @ApiProperty({ example: 'The payroll file came after the month was marked No payroll', description: 'Why (at least 5 characters)' })
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Say why, in a few words' })
  @MaxLength(300)
  reason: string;
}

export class OrganizationRefDto implements OrganizationRef {
  @ApiProperty({ example: 'cmb2x0k1p0000abcd1234efgh' })
  id: string;

  @ApiProperty({ example: 'NPF' })
  name: string;
}

export class VoucherReceiptDto implements VoucherReceipt {
  @ApiProperty({ example: 'cmb2x0k1p0000abcd1234efgh' })
  voucherId: string;

  @ApiProperty({ description: "The organization's variation the voucher is in, and now locks" })
  variationId: string;

  @ApiProperty({ type: OrganizationRefDto })
  organization: OrganizationRefDto;

  @ApiProperty({ example: 'JUNE 2026' })
  period: string;

  @ApiProperty({ example: 152, description: 'Data rows queued for processing' })
  rows: number;
}

export class PayrollRowIssueDto implements PayrollRowIssue {
  @ApiProperty({ example: 7, description: "The sheet's row number (the header is row 1)" })
  row: number;

  @ApiProperty({ example: '123456' })
  staffId: string;

  @ApiProperty({ example: ['amount must be a number of naira, 0 or more', 'duplicate staffid'] })
  issues: string[];
}

export class VariationRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 2, description: 'The version of its file the organization was last sent' })
  version: number;
}

export class VoucherIssueCountsDto implements VoucherIssueCounts {
  @ApiProperty({ example: 2, description: 'Rows no customer has the staff ID of (UNMATCHED)' })
  unmatched: number;

  @ApiProperty({ example: 1, description: 'Rows of a customer in another organization (REVIEWING)' })
  otherOrganization: number;

  @ApiProperty({ example: 0, description: 'Rows of a customer in this organization with no deduction in the variation (REVIEWING)' })
  notInVariation: number;
}

export class EarlierUnlockedDto implements EarlierUnlocked {
  @ApiProperty({ description: 'Mark it No payroll with POST /admin/variations/:variationId/no-payroll' })
  variationId: string;

  @ApiProperty({ example: '2026-05' })
  ym: string;

  @ApiProperty({ example: 'MAY 2026' })
  label: string;
}

export class VoucherReportDto implements VoucherReport {
  @ApiProperty({ example: false, description: 'True when the sheet can be uploaded as it is' })
  valid: boolean;

  @ApiProperty({ example: 'JUNE 2026', nullable: true, type: String })
  period: string | null;

  @ApiProperty({ example: 152 })
  rows: number;

  @ApiProperty({ example: [], description: 'Required columns the header row lacks' })
  missingColumns: string[];

  @ApiProperty({
    example: ["Generate NPF's JUNE 2026 variation first"],
    description: 'Plain sentences, most important first; the upload would be refused with the first one',
  })
  problems: string[];

  @ApiProperty({ type: [PayrollRowIssueDto] })
  invalidRows: PayrollRowIssueDto[];

  @ApiProperty({ type: OrganizationRefDto })
  organization: OrganizationRefDto;

  @ApiProperty({ type: VariationRefDto, nullable: true, description: "The organization's variation for the sheet's month; null when none was generated" })
  variation: VariationRefDto | null;

  @ApiProperty({ type: VoucherIssueCountsDto, description: 'Rows that would be left for an admin to resolve, by why' })
  issues: VoucherIssueCountsDto;

  @ApiProperty({ type: [EarlierUnlockedDto], description: "Earlier months of the organization with no voucher or No payroll yet" })
  earlierUnlocked: EarlierUnlockedDto[];

  @ApiProperty({ example: [], description: 'Why the upload would be refused with a 409 (also in `problems`)' })
  conflicts: string[];
}

export class VoucherRevertResultDto {
  @ApiProperty({ description: 'The variation is unlocked again: upload a voucher into it, or mark it No payroll' })
  variationId: string;

  @ApiProperty({ example: 152, description: "The voucher's payments removed (issues included)" })
  inflowsRemoved: number;

  @ApiProperty({ example: 4, description: 'Penalties charged when it was settled, removed' })
  penaltiesRemoved: number;

  @ApiProperty({ example: 1, description: 'Pending tenure extensions proposed when it was settled, withdrawn' })
  proposalsWithdrawn: number;
}

export class NoPayrollResultDto {
  @ApiProperty()
  variationId: string;

  @ApiProperty({ example: 'NPF · MAY 2026' })
  label: string;

  @ApiProperty({ example: 152, description: 'Deductions that failed (nothing came)' })
  failed: number;

  @ApiProperty({ example: 150, description: 'Penalties charged' })
  penalties: number;

  @ApiProperty({ example: 480000 })
  penaltyTotal: number;

  @ApiProperty({ example: 3, description: 'Tenure extensions proposed because the new monthly amount broke the net-pay cap' })
  proposals: number;
}

export class NoPayrollRevertResultDto {
  @ApiProperty()
  variationId: string;

  @ApiProperty({ example: 150, description: 'Penalties removed' })
  penaltiesRemoved: number;

  @ApiProperty({ example: 3, description: 'Pending tenure extensions withdrawn' })
  proposalsWithdrawn: number;
}
