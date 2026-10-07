type CustomerQuery = PaginatedApiQuery & {
  status?: UserStatus;
};

type CustomerLiquidationsQuery = PaginatedApiQuery & {
  status?: LiquidationStatus;
};

type CustomerTopupHistoryQuery = PaginatedApiQuery & {
  search?: string;
  status?: LoanStatus;
};

type CustomerTenureChangeQuery = PaginatedApiQuery & {
  status?: TenureChangeStatus;
};

type CustomerLoanStatementQuery = PaginatedApiQuery & {
  from?: string;
  to?: string;
};

type CustomerRepaymentsQuery = PaginatedApiQuery & {
  from?: string;
  to?: string;
  state?: PaymentInflowState;
  source?: PaymentInflowSource;
};

type CustomersQuery = PaginatedApiQuery & {
  search?: string;
  status?: UserStatus;
  accountOfficerId?: string;
  hasActiveLoan?: boolean;
  signupStart?: string;
  signupEnd?: string;
  repaymentRateMin?: number;
  repaymentRateMax?: number;
  grossPayMin?: number;
  grossPayMax?: number;
  netPayMin?: number;
  netPayMax?: number;
  organizationId?: string;
};

type AccountOfficerCustomersQuery = PaginatedApiQuery & {
  search?: string;
  status?: UserStatus;
};

type CreateIdentityDto = {
  dateOfBirth: string;
  residencyAddress: string;
  stateResidency: string;
  landmarkOrBusStop: string;
  nextOfKinName: string;
  nextOfKinContact: string;
  nextOfKinAddress: string;
  nextOfKinRelationship: Relationship;
  gender: Gender;
  maritalStatus: MaritalStatus;
};

type CreatePaymentMethodDto = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bvn: string;
};

type CreatePayrollDto = {
  externalId: string;
  grade?: string | undefined;
  step?: number | undefined;
  command: string;
  organization: string;
};

type CustomerUser = {
  name: string;
  email?: string;
  phoneNumber?: string;
};

type CustomerCashLoan = {
  amount: number;
  tenure: number;
};

type CustomerCommodityLoan = {
  assetName: string;
};

type CustomerLoan = {
  category: LoanCategory;
  cashLoan?: CustomerCashLoan;
  commodityLoan?: CustomerCommodityLoan;
  monthsDelta?: number;
};

/** POST /admin/customer/:id/loan-topup: the running loan keeps its category. */
type CustomerLoanTopup = {
  kind: "CASH" | "ASSET";
  cashLoan?: { amount: number };
  commodityLoan?: CustomerCommodityLoan;
  /** Cash only: months to add (≥ 1). */
  monthsDelta?: number;
};

type OnboardCustomer = {
  payroll: CreatePayrollDto;
  identity: CreateIdentityDto;
  paymentMethod: CreatePaymentMethodDto;
  user: CustomerUser;
  loan?: CustomerLoan;
};

type CustomerStatusDto = {
  status: UserStatus;
  reason?: string;
};

type InAppMessageCustomer = {
  title: string;
  message: string;
};

type LiquidationRequestDto = {
  amount: number;
};

type ReportRequestDto = {
  email: string;
};
