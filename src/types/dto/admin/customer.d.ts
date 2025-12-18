type CustomerQuery = PaginatedApiQuery & {
	status?: RepaymentStatus;
};

type CustomersQuery = PaginatedApiQuery & {
	search?: string;
	status?: UserStatus;
	officerId?: string;
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
};

type CreatePayrollDto = {
	externalId: string;
	employeeGross: string;
	netPay: string;
	grade?: string | undefined;
	step?: number | undefined;
	command: string;
};

type CustomerUser = {
	email?: string | undefined;
	contact?: string | undefined;
	name: string;
};

type CustomerCashLoan = {
	amount: number;
	tenure: number;
};

type CustomerCommodityLoan = {
	assetName: string;
	publicDetails: string;
	privateDetails: string;
	amount: number;
	tenure: number;
	managementFeeRate: number;
};

type CustomerLoan = {
	category: LoanCategory;
	cashLoan?: CustomerCashLoan;
	commodityLoan?: Pick<CustomerCommodityLoan, "assetName">;
};

type OnboardCustomer = {
	payroll: Omit<CreatePayrollDto, "employeeGross" | "netPay">;
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
