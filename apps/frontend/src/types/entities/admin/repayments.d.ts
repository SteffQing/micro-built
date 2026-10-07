type RepaymentOverviewDto = {
  from: string;
  to: string;
  expected: number;
  collected: number;
  overdue: number;
  underpaid: { amount: number; count: number };
  failed: { amount: number; count: number };
  currentPeriod: string;
  expectingThisPeriod: number;
  /** Money received for these months (rejected excluded). */
  received: { amount: number; count: number; bySource: Record<"PAYROLL" | "LIQUIDATION" | "IMPORT", number> };
  /** Of that, what was applied to loans. */
  applied: { amount: number; count: number; principal: number; interest: number; penalty: number };
  /** Received money, any month, still waiting on an admin. */
  unresolved: { amount: number; count: number };
};

type RepaymentUser = {
  id: string;
  name: string;
  repaymentRate: number;
  externalId: string | null;
};

type RepaymentsHistoryDto = {
  id: string;
  source: PaymentInflowSource;
  state: PaymentInflowState;
  period: string;
  amount: number;
  applied: number;
  customer: { id: string; name: string; externalId: string | null } | null;
  externalUserId: string | null;
  voucherId: string | null;
  hasProof: boolean;
  createdAt: string;
};

type SingleRepaymentWithUserDto = {
  id: string;
  source: PaymentInflowSource;
  state: PaymentInflowState;
  period: string;
  amount: number;
  applied: number;
  unapplied: number;
  loanId: string | null;
  customer: { id: string; name: string; externalId: string | null } | null;
  externalUserId: string | null;
  voucherId: string | null;
  hasProof: boolean;
  createdAt: string;
  repayment: {
    id: string;
    loanId: string;
    amount: number;
    principal: number;
    interest: number;
    penalty: number;
    createdAt: string;
  } | null;
  deduction: {
    id: string;
    period: string;
    expected: number;
    paid: number;
    status: DeductionStatus;
  } | null;
  loan: CashLoan | null;
  history: Array<{
    action: string;
    note: string | null;
    actorId: string | null;
    actorName: string | null;
    createdAt: string;
  }>;
};

type CustomerLiquidationsRequestDto = {
  id: string;
  amount: number;
  state: LiquidationStatus;
  requestedAt: string;
  decidedAt: string | null;
  note: string | null;
  hasProof: boolean;
};

type RepaymentPeriod = { ym: string; label: string };

/** GET /admin/repayments/deductions: what a loan is expected to pay for a payroll month. */
type DeductionListItemDto = {
  id: string;
  loanId: string;
  period: RepaymentPeriod;
  customer: { id: string; name: string; externalId: string | null };
  expected: number;
  paid: number;
  outstanding: number;
  status: DeductionStatus;
  settledAt: string | null;
  penalizedAt: string | null;
};

/** GET /admin/repayments/deductions/:id */
type DeductionDetailDto = DeductionListItemDto & {
  createdAt: string;
  /** Payments applied to this deduction, oldest first. */
  payments: Array<{
    id: string;
    paymentInflowId: string;
    source: PaymentInflowSource;
    amount: number;
    principal: number;
    interest: number;
    penalty: number;
    createdAt: string;
  }>;
  /** OPEN only: how the amount is worked out right now. Frozen once sent to payroll (null). */
  calculation: {
    owed: number;
    repaid: number;
    outstanding: number;
    committed: number;
    toSpread: number;
    tenure: number;
    monthsSent: number;
    remainingMonths: number;
    amount: number;
    stopped: boolean;
  } | null;
};

/** GET /admin/repayments/applied: a payment applied to a loan. */
type AppliedRepaymentListItemDto = {
  id: string;
  loanId: string;
  paymentInflowId: string;
  source: PaymentInflowSource;
  period: RepaymentPeriod;
  customer: { id: string; name: string; externalId: string | null };
  amount: number;
  principal: number;
  interest: number;
  penalty: number;
  deductionId: string | null;
  createdAt: string;
};
