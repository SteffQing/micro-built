import { Prisma } from '@prisma/client';

export interface UserLoans {
  loanBalance: Prisma.Decimal;
  amount: Prisma.Decimal;
  tenure: number;
  startDate: Date;
  endDate: Date;
}

export interface GenerateMonthlyLoanSchedule {
  period: string;
  email: string;
}

export interface ScheduleVariation {
  externalId: string;
  name: string;
  command: string;
  balance: number;
  expected: number;
  tenure: number;
  start: Date;
  end: Date;
}
