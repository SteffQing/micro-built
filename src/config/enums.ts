export const UserRole = {
  ADMIN: "ADMIN",
  CUSTOMER: "CUSTOMER",
  SUPER_ADMIN: "SUPER_ADMIN",
  VIEW_ADMIN: "VIEW_ADMIN",
} as const;

export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  FLAGGED: "FLAGGED",
} as const;

export const LoanCategory = {
  EDUCATION: "EDUCATION",
  PERSONAL: "PERSONAL",
  BUSINESS: "BUSINESS",
  MEDICAL: "MEDICAL",
  RENT: "RENT",
  TRAVEL: "TRAVEL",
  AGRICULTURE: "AGRICULTURE",
  UTILITIES: "UTILITIES",
  EMERGENCY: "EMERGENCY",
  OTHERS: "OTHERS",
  ASSET_PURCHASE: "ASSET_PURCHASE",
} as const;

export const LoanStatus = {
  PENDING: "PENDING",
  PREVIEW: "PREVIEW",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED",
  DISBURSED: "DISBURSED",
  REPAID: "REPAID",
} as const;

export const RepaymentStatus = {
  AWAITING: "AWAITING",
  PARTIAL: "PARTIAL",
  FULFILLED: "FULFILLED",
  OVERPAID: "OVERPAID",
  FAILED: "FAILED",
  MANUAL_RESOLUTION: "MANUAL_RESOLUTION",
} as const;

export const Gender = {
  Female: "Female",
  Male: "Male",
} as const;

export const MaritalStatus = {
  Single: "Single",
  Married: "Married",
  Divorced: "Divorced",
  Widowed: "Widowed",
} as const;

export const Relationship = {
  Spouse: "Spouse",
  Parent: "Parent",
  Child: "Child",
  Sibling: "Sibling",
  Other: "Other",
} as const;
