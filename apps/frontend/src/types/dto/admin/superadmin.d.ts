type ValidAdminRoles = Extract<UserRole, "ADMIN" | "SUPER_ADMIN">;

type InviteAdminDto = {
  email: string;
  name: string;
  role: Exclude<UserRole, "CUSTOMER">;
};

type RemoveAdminDto = {
  id: string;
};

type UpdateRateDto = {
  interestRate?: number;
  managementFeeRate?: number;
  penaltyRate?: number;
  maxDeductionRate?: number | null;
};

type CommodityDto = {
  name: string;
};

type UpdateCommodityDto = {
  active: boolean;
};
