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

function getLoanStatusColor(status: LoanStatus): string {
  switch (status) {
    case "PENDING":
      return "#f59e0b";
    case "PREVIEW":
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

export { getUserStatusColor, getUserStatusText, getLoanStatusColor };
