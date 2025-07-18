import { LoanStatus } from "./enums";

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
      return "#f59e0b"; // amber-500
    case "PREVIEW":
      return "#6366f1"; // indigo-500
    case "REJECTED":
      return "#ef4444"; // red-500
    case "ACCEPTED":
      return "#10b981"; // emerald-500
    case "APPROVED":
      return "#22c55e"; // green-500
    case "DISBURSED":
      return "#0ea5e9"; // sky-500
    case "REPAID":
      return "#14b8a6"; // teal-500
    default:
      return "#9ca3af"; // gray-400
  }
}

export { getUserStatusColor, getUserStatusText, getLoanStatusColor };
