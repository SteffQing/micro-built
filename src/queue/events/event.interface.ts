import { Prisma } from '@prisma/client';

export interface UserLoanCreateEvent {
  id: string;
  userId: string;
  interestPerAnnum: number;
  managementFeeRate: number;
}

export interface UserCommodityLoanCreateEvent {
  assetName: string;
  id: string;
  userId: string;
}

export interface AdminInviteEvent {
  adminId: string;
  existing: {
    id: string;
  } | null;
}

export interface AdminResolveRepaymentEvent {
  id: string;
  note: string;
  repayment: {
    period: string;
    userId: string;
    amount: Prisma.Decimal;
    penalty: Prisma.Decimal;
  };
}
