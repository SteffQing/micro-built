export interface UserLoanCreateEvent {
  id: string;
  userId: string;
  interestPerAnnum: number;
  managementFeeRate: number;
}

export interface UserCommodityLoanCreateEvent {
  assetName: string;
  id: string;
  userId: string;
}
