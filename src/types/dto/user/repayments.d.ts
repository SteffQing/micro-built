type UserRepaymentsQuery = PaginatedApiQuery & {
  status?: RepaymentStatus;
};
