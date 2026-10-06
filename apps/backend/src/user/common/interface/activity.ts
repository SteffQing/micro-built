import type { Period } from '@microbuilt/shared';
import type {
  CommodityRequestStatus,
  LoanCategory,
  LoanStatus,
  MicroLoanPurpose,
  MicroLoanStatus,
  PaymentInflowSource,
  PaymentInflowState,
  Prisma,
  TenureChangeStatus,
} from '@prisma/client';

/** What an activity item is about; the frontend picks its icon by it. */
export const ACTIVITY_SOURCES = [
  'User',
  'UserIdentity',
  'UserPaymentMethod',
  'Loan',
  'Topup',
  'Penalty',
  'Commodity',
  'Repayment',
  'Liquidation',
] as const;

export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export interface ActivitySummary {
  title: string;
  description: string;
  date: Date;
  source: ActivitySource;
}

/** The rows a customer's feed is built from, as the recent-activity queries select them. */
export interface ActivityRows {
  user: { createdAt: Date } | null;
  identity: { createdAt: Date; updatedAt: Date } | null;
  paymentMethod: { createdAt: Date; updatedAt: Date; bankName: string } | null;
  loans: {
    id: string;
    category: LoanCategory;
    status: LoanStatus;
    principal: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }[];
  /** NEW_LOAN, TOPUP and PENALTY microloans (interest is part of a disbursement). */
  microLoans: {
    loanId: string;
    purpose: MicroLoanPurpose;
    status: MicroLoanStatus;
    amount: Prisma.Decimal;
    createdAt: Date;
    disbursedAt: Date | null;
    tenureChange: { monthsDelta: number; status: TenureChangeStatus } | null;
    /** The asset request a top-up pays for (an asset top-up), else null. */
    commodity: { commodity: { name: string } } | null;
  }[];
  commodities: { status: CommodityRequestStatus; createdAt: Date; commodity: { name: string } }[];
  repayments: {
    loanId: string;
    amount: Prisma.Decimal;
    createdAt: Date;
    paymentInflow: { source: PaymentInflowSource; period: Period };
  }[];
  /** The customer's liquidation requests (PaymentInflow LIQUIDATION), whatever their state. */
  liquidations: { amount: Prisma.Decimal; state: PaymentInflowState; createdAt: Date }[];
}
