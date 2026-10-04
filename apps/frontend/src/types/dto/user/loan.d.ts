type CreateLoanDto = {
  amount: number;
  category?: LoanCategory;
};

type CreateCommodityLoanDto = {
  assetName: string;
};

type UpdateLoanDto = {
  amount?: number;
  category?: LoanCategory;
};

type LoanRequestResponseDto = {
  kind: "LOAN" | "TOPUP";
  id: string;
  loanId: string;
};

type CommodityLoanRequestResponseDto = {
  kind: "LOAN" | "TOPUP";
  id: string;
  loanId: string;
};
