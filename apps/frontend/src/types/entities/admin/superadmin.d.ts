type AdminListDto = {
  id: string;
  avatar: string | null;
  name: string;
  role: UserRole;
  email: string;
  status: UserStatus;
};

type AccountOfficerDto = {
  id: string;
  name: string;
  role: UserRole | "SYSTEM";
  customersCount: number;
  isSystem: boolean;
};

type AccountOfficerStatsDto = {
  customers: {
    total: number;
    active: number;
    inactive: number;
    flagged: number;
    avgRepaymentScore: number;
  };
  portfolio: {
    totalLoans: number;
    totalDisbursed: number;
    totalRepaid: number;
    totalPenalty: number;
    outstandingBalance: number;
  };
};
