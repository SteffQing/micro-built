type CreateLoanDto = {
  amount: number;
  category: LoanCategory;
};

type UpdateLoanStatusDto = {
  status: LoanStatus.APPROVED | LoanStatus.REJECTED;
};

type CreateCommodityLoanDto = {
  assetName: string;
};
