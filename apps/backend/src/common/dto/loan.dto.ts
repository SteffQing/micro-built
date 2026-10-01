import { ApiProperty } from '@nestjs/swagger';
import type { Loan } from '@prisma/client';
import { loanBalancesMany, openExpectedMany, type LoanBalances } from 'src/ledger/balances';
import type { Tx } from 'src/ledger/ledger.tx';
import { toNumber, type Money } from 'src/ledger/money';

/**
 * What every loan response shows about the money (V2.MD §0.6), from the ledger's rows. Loan
 * response classes extend it and spread `toLoanFigures(...)` / `loanFiguresMany(...)` in.
 */
export class LoanFiguresDto {
  @ApiProperty({ example: 120000, description: 'Principal + interest + penalties booked so far' })
  owed: number;

  @ApiProperty({ example: 30000 })
  repaid: number;

  @ApiProperty({ example: 90000, description: 'owed − repaid' })
  outstanding: number;

  @ApiProperty({ example: 100000, description: 'The loan amount plus any disbursed top-ups' })
  principal: number;

  @ApiProperty({ example: 20000 })
  interestBooked: number;

  @ApiProperty({ example: 0 })
  penaltyBooked: number;

  @ApiProperty({ example: 6, description: 'Months (including approved tenure changes)' })
  tenure: number;

  @ApiProperty({
    example: 4,
    description: 'Months still to deduct: the tenure until disbursed, 0 once repaid',
  })
  remainingMonths: number;

  @ApiProperty({
    example: 22500,
    nullable: true,
    type: Number,
    description: "The deduction being worked out for the next payroll month; null when there isn't one",
  })
  monthly: number | null;
}

export type LoanFiguresSource = Pick<Loan, 'id' | 'status' | 'principal' | 'tenure'>;

export function toLoanFigures(
  loan: LoanFiguresSource,
  balances: LoanBalances | undefined,
  monthly: Money | null | undefined,
): LoanFiguresDto {
  const remainingMonths =
    loan.status === 'DISBURSED' ? (balances?.remainingMonths ?? loan.tenure) : loan.status === 'REPAID' ? 0 : loan.tenure;
  return {
    owed: toNumber(balances?.owed ?? 0),
    repaid: toNumber(balances?.repaid ?? 0),
    outstanding: toNumber(balances?.outstanding ?? 0),
    principal: toNumber(loan.principal),
    interestBooked: toNumber(balances?.booked.interest ?? 0),
    penaltyBooked: toNumber(balances?.booked.penalty ?? 0),
    tenure: loan.tenure,
    remainingMonths,
    monthly: monthly ? toNumber(monthly) : null,
  };
}

/** Figures for many loans in two queries, keyed by loan id. */
export async function loanFiguresMany(
  db: Tx,
  loans: LoanFiguresSource[],
): Promise<Map<string, LoanFiguresDto>> {
  const ids = loans.map((loan) => loan.id);
  const [balances, monthly] = await Promise.all([loanBalancesMany(db, ids), openExpectedMany(db, ids)]);
  return new Map(loans.map((loan) => [loan.id, toLoanFigures(loan, balances.get(loan.id), monthly.get(loan.id))]));
}
