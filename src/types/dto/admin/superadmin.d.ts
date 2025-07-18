type InviteAdminDto = {
  email: string;
  name: string;
};

type UpdateRateDto = {
  key: "INTEREST_RATE" | "MANAGEMENT_FEE_RATE";
  value: number;
};

type CommodityDto = {
  name: string;
};
