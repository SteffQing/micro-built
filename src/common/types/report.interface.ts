import { Prisma } from '@prisma/client';

export interface UserLoans {
  loanBalance: Prisma.Decimal;
  amount: Prisma.Decimal;
  tenure: number;
  startDate: Date;
  endDate: Date;
}
