type CustomerQuery = PaginatedApiQuery & {
  status?: RepaymentStatus;
};

type CustomersQuery = PaginatedApiQuery & {
  search?: string;
  status?: UserStatus;
};

type FilterRepayments = {
  status?: RepaymentStatus;
};
