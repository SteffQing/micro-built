type CreateLoanDto = {
  amount: number;
  category: LoanCategory;
};

type UpdateLoanStatusDto = {
  status: "APPROVED" | "REJECTED";
};

type CreateCommodityLoanDto = {
  assetName: string;
};
