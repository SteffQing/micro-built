type ValidAdminRoles = Extract<UserRole, "ADMIN" | "SUPER_ADMIN">;

type InviteAdminDto = {
  email: string;
  name: string;
  role: Extract<UserRole, "ADMIN" | "SUPER_ADMIN">;
};

type RemoveAdminDto = {
  id: string;
};

type UpdateRateDto = {
  key: "INTEREST_RATE" | "MANAGEMENT_FEE_RATE" | "PENALTY_FEE_RATE";
  value: number;
};

type CommodityDto = {
  name: string;
};
