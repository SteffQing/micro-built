type ConfigData = {
  maintenanceMode: boolean;
  interestRate: number | null;
  managementFeeRate: number | null;
  penaltyRate: number | null;
  maxDeductionRate: number | null;
  commodities: string[];
};

type RateSettings = {
  interestRate: number | null;
  managementFeeRate: number | null;
  penaltyRate: number | null;
  maxDeductionRate: number | null;
  inMaintenance: boolean;
};

type CommodityItem = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
};
