type CustomerInfoDto = {
  id: string;
  name: string;
  email: string | null;
  status: UserStatus;
  contact: string | null;
  avatar: string | null;
};

type ActiveLoanDto = {
  id: string;
  amount: number;
  loanTenure: number;
  amountRepaid: number;
  balance: number;
};

type PendingLoanDto = {
  id: string;
  category: LoanCategory;
  amount: number;
  date: Date;
};

type UserLoansDto = {
  activeLoans: ActiveLoanDto[];
  pendingLoans: PendingLoanDto[];
};

type UserLoanSummaryDto = {
  totalBorrowed: number;
  totalOutstanding: number;
  defaultedRepaymentsCount: number;
  flaggedRepaymentsCount: number;
};

type CustomerListItemDto = {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  status: UserStatus;
  repaymentRate: number;
};

type CustomersOverviewDto = {
  activeCustomersCount: number;
  flaggedCustomersCount: number;
  customersWithActiveLoansCount: number;
  defaultedCount: number;
  flaggedCount: number;
  ontimeCount: number;
};

type CustomerPPI = {
  payroll: UserPayroll | null;
  identity: UserIdentity | null;
  paymentMethod: UserPaymentMethod | null;
};
