type GetUser = {
  id: string;
  name: string;
  contact: string | null;
  avatar: string | null;
  email: string | null;
  status: UserStatus;
  role: UserRole;
};

type UserDashboardDto = {
  activeLoanAmount: number;
  activeLoanRepaid: number;
  repaymentRate: number;
  pendingLoanRequestsCount: number;
  lastDeduction: {
    amount: number;
    date: string;
  };
  nextRepaymentDate: string;
};

type ActivitySource =
  | "User"
  | "UserIdentity"
  | "UserPaymentMethod"
  | "Loan"
  | "Repayment";

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
