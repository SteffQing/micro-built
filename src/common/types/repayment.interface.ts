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
  amount: number;
  period: string;
  resolutionNote: string;
}

export interface LiquidationResolution {
  amount: number;
  userId: string;
  liquidationRequestId: string;
}

export interface PrivateRepaymentHandler {
  period: string;
  userId: string;
  amount: number;
  resolutionNote?: string;
  repaymentId?: string;
  liquidationRequestId?: string;
}
