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
  uploadId: string | null;
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
  uploadId: string | null;
  hasProof: boolean;
  createdAt: string;
  repayment: {
    principal: number;
    interest: number;
    penalty: number;
  } | null;
  deduction: {
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
