const getUserStatusColor = (status: UserStatus) => {
  switch (status) {
    case "ACTIVE":
      return "bg-[#E2FFE8] text-[#13E741]";
    case "FLAGGED":
      return "bg-[#FFEBEB] text-[#FF4141]";
    case "INACTIVE":
      return "bg-[#F5F5F5] text-[#999999]";
    default:
      return "";
  }
};

const getUserStatusText = (status: UserStatus) => {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "FLAGGED":
      return "Suspended";
    case "INACTIVE":
      return "Inactive";
    default:
      return "";
  }
};

type StatusBadge = { label: string; className: string };

const badge = {
  success: "bg-[#E2FFE8] text-[#13E741]",
  pending: "bg-[#FFEDE0] text-[#F97316]",
  failed: "bg-[#FFEBEB] text-[#FF4141]",
  neutral: "bg-[#F5F5F5] text-[#999999]",
} as const;

const getRepaymentStatusBadge = (status: RepaymentStatus): StatusBadge => {
  switch (status) {
    case "FULFILLED":
      return { label: "Success", className: badge.success };
    case "AWAITING":
      return { label: "Pending", className: badge.pending };
    case "PARTIAL":
      return { label: "Partial", className: badge.pending };
    case "FAILED":
      return { label: "Failed", className: badge.failed };
    case "MANUAL_RESOLUTION":
      return { label: "Manual Review", className: badge.neutral };
    default:
      return { label: status, className: badge.neutral };
  }
};

const getLiquidationStatusBadge = (status: LiquidationStatus): StatusBadge => {
  switch (status) {
    case "APPROVED":
      return { label: "Success", className: badge.success };
    case "PENDING":
      return { label: "Pending", className: badge.pending };
    case "REVIEWING":
      return { label: "Reviewing", className: badge.neutral };
    case "REJECTED":
      return { label: "Failed", className: badge.failed };
    default:
      return { label: status, className: badge.neutral };
  }
};

function getLoanStatusColor(status: LoanStatus | LiquidationStatus): string {
  switch (status) {
    case "PENDING":
      return "#f59e0b";
    case "REVIEWING":
      return "#6366f1";
    case "REJECTED":
      return "#ef4444";
    case "APPROVED":
      return "#22c55e";
    case "DISBURSED":
      return "#0ea5e9";
    case "REPAID":
      return "#14b8a6";
    default:
      return "#9ca3af";
  }
}

export {
  getUserStatusColor,
  getUserStatusText,
  getLoanStatusColor,
  getRepaymentStatusBadge,
  getLiquidationStatusBadge,
};
