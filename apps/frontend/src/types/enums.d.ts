type UserRole = "ADMIN" | "CUSTOMER" | "MARKETER" | "SUPER_ADMIN";

type UserStatus = "ACTIVE" | "INACTIVE" | "FLAGGED";

type LoanCategory =
  | "EDUCATION"
  | "PERSONAL"
  | "BUSINESS"
  | "MEDICAL"
  | "RENT"
  | "TRAVEL"
  | "AGRICULTURE"
  | "UTILITIES"
  | "EMERGENCY"
  | "OTHERS"
  | "ASSET_PURCHASE";

type LoanStatus = "PENDING" | "REJECTED" | "APPROVED" | "DISBURSED" | "REPAID";

type RepaymentStatus =
  | "AWAITING"
  | "PARTIAL"
  | "FULFILLED"
  | "FAILED"
  | "MANUAL_RESOLUTION";

type LiquidationStatus = "PENDING" | "REVIEWING" | "APPROVED" | "REJECTED";

type Gender = "Female" | "Male";

type MaritalStatus = "Single" | "Married" | "Divorced" | "Widowed";

type Relationship = "Spouse" | "Parent" | "Child" | "Sibling" | "Other";

// v2 enums

type DeductionStatus = "EXPECTED" | "PAID" | "PARTIAL" | "FAILED";

type PaymentInflowState =
  | "AWAITING"
  | "SETTLED"
  | "REVIEWING"
  | "UNMATCHED"
  | "REJECTED";

type PaymentInflowSource = "PAYROLL" | "LIQUIDATION";

type MicroLoanPurpose = "CASH" | "COMMODITY";

type MicroLoanStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DISBURSED"
  | "REPAID";

type TenureChangeReason = "DEFAULT" | "TOPUP" | "LIQUIDATION" | "ADMIN";

type TenureChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

type CommodityRequestStatus = "IN_REVIEW" | "APPROVED" | "REJECTED";

type Month =
  | "JANUARY"
  | "FEBRUARY"
  | "MARCH"
  | "APRIL"
  | "MAY"
  | "JUNE"
  | "JULY"
  | "AUGUST"
  | "SEPTEMBER"
  | "OCTOBER"
  | "NOVEMBER"
  | "DECEMBER";
