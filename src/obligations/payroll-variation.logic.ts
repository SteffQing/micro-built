import { PayrollVariationFilter } from 'src/common/types/report.interface';
import { money, stableHash } from './repayment-plan.logic';

export interface PayrollInstruction {
  borrowerId: string;
  obligationId: string;
  installmentId: string | null;
  planId: string | null;
  externalId: string;
  borrowerName: string;
  command: string;
  amount: string;
  contractualOutstanding: string;
  penaltyOutstanding: string;
  totalOutstanding: string;
  termRemaining: number;
  effectiveFromPeriod: string;
  endDate: string | null;
  sourceEventIds: string[];
  reasons: string[];
  changeTypes: string[];
}

export interface PreviousPayrollInstruction extends PayrollInstruction {
  id: string;
  action: 'START' | 'AMEND' | 'STOP';
}

export interface PayrollVariationChange extends PayrollInstruction {
  action: 'START' | 'AMEND' | 'STOP';
  previousRowId: string | null;
  previousAmount: string | null;
  instructionHash: string;
}

// Running balances and remaining tenure naturally decrease every month. Only
// compare the instruction payroll must act on, using an absolute expiry date.
export function payrollInstructionHash(instruction: PayrollInstruction) {
  return stableHash({
    obligationId: instruction.obligationId,
    externalId: instruction.externalId,
    borrowerName: instruction.borrowerName,
    command: instruction.command,
    amount: money(instruction.amount).toFixed(2),
    endDate: instruction.endDate,
  });
}

export function payrollInstructionIsActive(
  previous: PreviousPayrollInstruction | undefined,
  period: Date,
) {
  return (
    !!previous &&
    previous.action !== 'STOP' &&
    money(previous.amount).gt(0) &&
    (!previous.endDate || new Date(previous.endDate) >= period)
  );
}

export function calculatePayrollVariation(
  desired: PayrollInstruction[],
  previous: PreviousPayrollInstruction[],
  period: Date,
): PayrollVariationChange[] {
  const previousByBorrower = new Map(
    previous.map((row) => [row.borrowerId, row]),
  );
  const seen = new Set<string>();
  const changes: PayrollVariationChange[] = [];

  for (const instruction of desired) {
    if (seen.has(instruction.borrowerId)) {
      throw new Error('More than one final payroll instruction for a customer');
    }
    seen.add(instruction.borrowerId);
    const prior = previousByBorrower.get(instruction.borrowerId);
    const wasActive = payrollInstructionIsActive(prior, period);
    const isStop = money(instruction.amount).eq(0);
    if (isStop && !wasActive) continue;
    const instructionHash = payrollInstructionHash(instruction);
    if (
      !isStop &&
      wasActive &&
      prior &&
      payrollInstructionHash(prior) === instructionHash
    )
      continue;

    changes.push({
      ...instruction,
      // Legacy backfilled loans may have no ADVANCE_DISBURSED event. Their
      // first positive instruction still belongs in the new-loan selection.
      changeTypes: [...new Set([...instruction.changeTypes, ...(!isStop && !wasActive ? ['NEW_LOAN'] : [])])],
      action: isStop ? 'STOP' : wasActive ? 'AMEND' : 'START',
      previousRowId: prior?.id ?? null,
      previousAmount: prior?.amount ?? null,
      instructionHash,
      reasons: [
        ...new Set(
          instruction.reasons.length
            ? instruction.reasons
            : [
                isStop
                  ? 'Loan settled'
                  : wasActive
                    ? 'Scheduled deduction changed'
                    : 'New payroll deduction',
              ],
        ),
      ],
    });
  }
  return changes.sort((a, b) => a.externalId.localeCompare(b.externalId));
}

const EVENT_CHANGE_TYPES: Record<string, string> = {
  ADVANCE_DISBURSED: 'NEW_LOAN', TOPUP_DISBURSED: 'TOPUP',
  LIQUIDATION_APPLIED: 'LIQUIDATION', TENURE_CHANGE_APPROVED: 'TENURE_CHANGE',
};

export function payrollChangeTypes(eventTypes: string[]): string[] {
  return [...new Set(eventTypes.map((type) => EVENT_CHANGE_TYPES[type]).filter(Boolean))].sort();
}

export function filterPayrollVariation(rows: PayrollVariationChange[], filter: PayrollVariationFilter) {
  if (filter === PayrollVariationFilter.ALL) return rows;
  return rows.filter((row) => filter === PayrollVariationFilter.COMBINED
    ? ['TOPUP', 'LIQUIDATION', 'TENURE_CHANGE'].every((type) => row.changeTypes.includes(type))
    : row.changeTypes.includes(filter));
}
