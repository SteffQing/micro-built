import { ApiProperty } from '@nestjs/swagger';
import type { VariationAction, VariationReason } from 'src/ledger/variation';
import { VARIATION_ACTIONS, VARIATION_REASONS } from './variations.dto';

// Responses of /admin/variations (PLAN_V2 §2). Dates are ISO strings and money is a number (naira, 2 dp).

export class VariationOrganizationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'NPF' })
  name: string;
}

export class VariationMonthDto {
  @ApiProperty({ example: '2026-10', description: 'YYYY-MM' })
  ym: string;

  @ApiProperty({ example: 'OCTOBER 2026' })
  label: string;
}

export class VariationLockDto {
  @ApiProperty({
    enum: ['VOUCHER', 'NO_PAYROLL'],
    description: 'What locked the variation: its voucher came in, or the month was marked No payroll',
  })
  kind: 'VOUCHER' | 'NO_PAYROLL';

  @ApiProperty({ required: false, description: 'VOUCHER: the voucher' })
  voucherId?: string;

  @ApiProperty({ required: false, example: 'NPF OCTOBER 2026.xlsx', description: 'VOUCHER: the uploaded file' })
  filename?: string;

  @ApiProperty({ required: false, type: String, format: 'date-time', description: 'VOUCHER: when it was uploaded' })
  uploadedAt?: string;

  @ApiProperty({ required: false, example: 'Payroll sent nothing', description: 'NO_PAYROLL: why' })
  reason?: string;
}

export class VariationStateDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 2, description: 'The current file version: each generation adds one' })
  version: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it was first generated' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it was last generated' })
  updatedAt: string;

  @ApiProperty({ type: VariationLockDto, nullable: true, description: 'Null while it can still be regenerated' })
  lock: VariationLockDto | null;

  @ApiProperty({
    description:
      'Generated before the organization’s previous month last locked or was reverted: its amounts may be stale, so ' +
      'generate it again',
  })
  regenerateHint: boolean;

  @ApiProperty({
    type: [Number],
    example: [1, 2],
    description: 'File versions still stored, ascending: every one until the variation locks, then the current one',
  })
  versions: number[];
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

  @ApiProperty({ example: '01/10/2026', description: 'dd/MM/yyyy' })
  start: string;

  @ApiProperty({ example: '31/01/2027', description: 'dd/MM/yyyy' })
  end: string;
}

export class VariationActionCountsDto {
  @ApiProperty({ example: 3 })
  START: number;

  @ApiProperty({ example: 5 })
  AMEND: number;

  @ApiProperty({ example: 1 })
  STOP: number;
}

export class OrganizationVariationDto {
  @ApiProperty({ type: VariationOrganizationDto })
  organization: VariationOrganizationDto;

  @ApiProperty({ type: VariationMonthDto })
  period: VariationMonthDto;

  @ApiProperty({
    type: VariationStateDto,
    nullable: true,
    description: 'Null until the month has been generated for this organization',
  })
  variation: VariationStateDto | null;

  @ApiProperty({
    type: [VariationRowDto],
    description:
      'After the action/reason filter: what generating would put in the file now. Once the variation is locked, what ' +
      'its current version holds.',
  })
  rows: VariationRowDto[];

  @ApiProperty({ type: VariationActionCountsDto, description: 'Over every row, before the filter' })
  counts: VariationActionCountsDto;

  @ApiProperty({
    example: 40,
    description: 'Deductions generating would freeze, the unchanged ones included (they stay off the file)',
  })
  frozen: number;

  @ApiProperty({ description: 'The organization has no deductions this month: nothing to generate, no voucher to expect' })
  skipped: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Generate NPF’s SEPTEMBER 2026 variation first',
    description: 'Why generating is refused now; null when it can go ahead',
  })
  generateBlockedBy: string | null;
}

export class VariationHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: VariationMonthDto })
  period: VariationMonthDto;

  @ApiProperty({ example: 2, description: 'The current file version' })
  version: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it was last generated' })
  updatedAt: string;

  @ApiProperty({ type: VariationLockDto, nullable: true })
  lock: VariationLockDto | null;
}

export class VariationRefusedDto extends VariationOrganizationDto {
  @ApiProperty({ example: 'Generate NPF’s SEPTEMBER 2026 variation first' })
  reason: string;
}

export class GenerateVariationsResultDto {
  @ApiProperty({ type: VariationMonthDto })
  period: VariationMonthDto;

  @ApiProperty({
    type: [VariationOrganizationDto],
    description: 'A job each: the requester is told in-app when it finishes or fails',
  })
  queued: VariationOrganizationDto[];

  @ApiProperty({ type: [VariationOrganizationDto], description: 'No deductions in the month: nothing to generate' })
  skipped: VariationOrganizationDto[];

  @ApiProperty({ type: [VariationRefusedDto] })
  refused: VariationRefusedDto[];
}

export class VariationDraftResultDto {
  @ApiProperty({ example: 'OCTOBER 2026' })
  period: string;

  @ApiProperty({ example: 'NPF' })
  organization: string;

  @ApiProperty({ example: 'admin@example.com', description: 'Where the draft goes: the signed-in admin’s own address' })
  email: string;
}

export class VariationFileUrlDto {
  @ApiProperty({ example: 'https://…supabase.co/storage/v1/object/sign/…' })
  url: string;

  @ApiProperty({ example: 600, description: 'Seconds the link stays valid' })
  expiresIn: number;

  @ApiProperty({ example: 'variation-npf-2026-10-v2.xlsx', description: 'The name to save the file as' })
  filename: string;
}
