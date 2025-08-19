// export interface RepaymentEntry {
//   staffId: string;
//   legacyId: string;
//   fullName: string;
//   grade: string;
//   step: number;
//   command: string;
//   element: string;
//   amount: number;
//   employeeGross: number;
//   netPay: number;
//   period: string;

import { Prisma } from '@prisma/client';

// }
export interface RepaymentEntry {
  externalId: string;
  payroll: {
    grade: string;
    step: number;
    command: string;
    employeeGross: number;
    netPay: number;
  };
  repayment: { amount: number; period: string };
}

export interface UploadRepayment {
  url: string;
  period: string;
}

export interface ResolveRepayment {
  repaymentId: string;
  userId: string;
  amount: Prisma.Decimal;
  period: string;
  allowPenalty: boolean;
  resolutionNote: string;
}

export interface LiquidationResolution {
  allowPenalty: boolean;
  amount: Prisma.Decimal;
  userId: string;
  liquidationRequestId: string;
}

export interface PrivateRepaymentHandler {
  period: string;
  userId: string;
  amount: Prisma.Decimal;
  allowPenalty: boolean;
  _updated: boolean; // for LR it is true, for OR it is false
  resolutionNote?: string;
  repaymentId?: string;
  liquidationRequestId?: string;
}
