import type { TenureChangeReason } from '@prisma/client';

// Everything the ledger announces. Emitted only after the transaction that caused it commits
// (LedgerTx.emit), so a listener never sees money that was rolled back. Listeners (Stage 5)
// notify people; they never write money.
export const LedgerEvents = {
  loanDisbursed: 'loan.disbursed',
  topupDecided: 'topup.decided',
  topupDisbursed: 'topup.disbursed',
  penaltyApplied: 'penalty.applied',
  tenureChangeProposed: 'tenure-change.proposed',
  tenureChangeApproved: 'tenure-change.approved',
  tenureChangeRejected: 'tenure-change.rejected',
  loanRepaid: 'loan.repaid',
  liquidationDecided: 'liquidation.decided',
} as const;

export type LedgerEventName = (typeof LedgerEvents)[keyof typeof LedgerEvents];

interface LoanRef {
  loanId: string;
  borrowerId: string;
}

// Amounts are naira as numbers (display only); the ledger itself keeps Decimals.
export interface LedgerEventPayloads {
  'loan.disbursed': LoanRef & { principal: number; interest: number; owed: number; monthly: number };
  'topup.decided': LoanRef & { microLoanId: string; amount: number; approved: boolean; note?: string };
  'topup.disbursed': LoanRef & { microLoanId: string; amount: number; interest: number; monthly: number };
  'penalty.applied': LoanRef & { microLoanId: string; amount: number; note?: string };
  'tenure-change.proposed': LoanRef & {
    changeId: string;
    monthsDelta: number;
    reason: TenureChangeReason;
    bySystem: boolean;
  };
  'tenure-change.approved': LoanRef & { changeId: string; monthsDelta: number; tenure: number };
  'tenure-change.rejected': LoanRef & { changeId: string; monthsDelta: number; note?: string };
  'loan.repaid': LoanRef;
  'liquidation.decided': LoanRef & { inflowId: string; amount: number; approved: boolean; note?: string };
}
