type UserRole = "ADMIN" | "CUSTOMER" | "SUPER_ADMIN" | "VIEW_ADMIN";

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

type LoanStatus = "PENDING" | "PREVIEW" | "REJECTED" | "APPROVED" | "DISBURSED" | "REPAID";

type RepaymentStatus = "AWAITING" | "PARTIAL" | "FULFILLED" | "FAILED" | "MANUAL_RESOLUTION";

type LiquidationStatus = "PENDING" | "APPROVED" | "REJECTED";

type Gender = "Female" | "Male";

type MaritalStatus = "Single" | "Married" | "Divorced" | "Widowed";

type Relationship = "Spouse" | "Parent" | "Child" | "Sibling" | "Other";
