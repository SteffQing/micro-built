const getUserStatusColor = (status: UserStatus) => {
  switch (status) {
    case "ACTIVE":
      return "bg-success/12 text-success";
    case "FLAGGED":
      return "bg-destructive/12 text-destructive";
    case "INACTIVE":
      return "bg-muted text-muted-foreground";
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
  success: "bg-success/12 text-success",
  pending: "bg-warning/12 text-warning",
  failed: "bg-destructive/12 text-destructive",
  neutral: "bg-muted text-muted-foreground",
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

const getPaymentInflowStateBadge = (status: PaymentInflowState): StatusBadge => {
  switch (status) {
    case "SETTLED":
      return { label: "Settled", className: badge.success };
    case "AWAITING":
      return { label: "Awaiting", className: badge.pending };
    case "REVIEWING":
      return { label: "Reviewing", className: badge.neutral };
    case "UNMATCHED":
      return { label: "Unmatched", className: badge.neutral };
    case "REJECTED":
      return { label: "Rejected", className: badge.failed };
    default:
      return { label: status, className: badge.neutral };
  }
};

// IMPORT is what an imported running loan had already repaid before it came over, not a payroll month.
const INFLOW_SOURCES: Record<PaymentInflowSource, StatusBadge> = {
  PAYROLL: { label: "Payroll", className: "bg-muted text-muted-foreground" },
  LIQUIDATION: { label: "Liquidation", className: "bg-primary/10 text-primary" },
  IMPORT: { label: "Imported balance", className: "bg-warning/12 text-warning" },
};

const getInflowSourceBadge = (source: PaymentInflowSource): StatusBadge => INFLOW_SOURCES[source];

const getDeductionStatusBadge = (status: DeductionStatus): StatusBadge => {
  switch (status) {
    case "FULFILLED":
      return { label: "Fulfilled", className: badge.success };
    case "AWAITING":
      return { label: "Awaiting", className: badge.pending };
    case "PARTIAL":
      return { label: "Partial", className: badge.pending };
    case "FAILED":
      return { label: "Failed", className: badge.failed };
    case "OPEN":
      return { label: "Open", className: badge.neutral };
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

// Tinted token pills: readable in both themes (the old solid hex fills under light text were ~2:1).
function getLoanStatusColor(status: LoanStatus | LiquidationStatus): string {
  switch (status) {
    case "PENDING":
    case "REVIEWING":
      return "bg-warning/12 text-warning";
    case "REJECTED":
      return "bg-destructive/12 text-destructive";
    case "APPROVED":
      return "bg-chart-2/15 text-chart-2";
    case "DISBURSED":
      return "bg-primary/10 text-primary";
    case "REPAID":
      return "bg-success/12 text-success";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export {
  getUserStatusColor,
  getUserStatusText,
  getLoanStatusColor,
  getRepaymentStatusBadge,
  getPaymentInflowStateBadge,
  getDeductionStatusBadge,
  getInflowSourceBadge,
  getLiquidationStatusBadge,
};
