type GetUser = {
  id: string;
  name: string;
  phoneNumber: string | null;
  image: string | null;
  email: string | null;
  status: UserStatus;
  role: UserRole;
  type: string;
  twoFactorEnabled: boolean;
  externalId: string | null;
  flagReason: string | null;
  accountOfficer: { id: string; name: string } | null;
  createdAt: string;
};

type UserDashboardDto = {
  currentLoan: (LoanFigures & {
    id: string;
    category: LoanCategory;
    status: LoanStatus;
    disbursementDate: string | null;
    createdAt: string;
  }) | null;
  repaymentRate: number;
  pendingLoanRequestsCount: number;
  pendingRequests: {
    loans: number;
    topups: number;
    commodities: number;
  };
  lastDeduction: {
    amount: number;
    date: string;
    period: string;
    source: PaymentInflowSource;
  } | null;
  nextDeduction: {
    amount: number;
    period: string;
  } | null;
};

type ActivitySource =
  | "User"
  | "UserIdentity"
  | "UserPaymentMethod"
  | "Loan"
  | "Topup"
  | "Penalty"
  | "Commodity"
  | "Repayment"
  | "Liquidation";

type UserActivityDto = {
  title: string;
  description: string;
  date: Date;
  source: ActivitySource;
};

type UserIdentityDto = Omit<UserIdentity, "userId" | "createdAt" | "updatedAt">;

type UserPaymentMethodDto = Omit<
  UserPaymentMethod,
  "userId" | "createdAt" | "updatedAt"
>;

type UserPayrollDto = {
  externalId: string;
  netPay: number;
  employeeGross: number;
  grade: string | null;
  step: number | null;
  command: string;
  organization: string;
};
