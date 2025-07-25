enum UserRole {
  ADMIN = "ADMIN",
  CUSTOMER = "CUSTOMER",
  SUPER_ADMIN = "SUPER_ADMIN",
  VIEW_ADMIN = "VIEW_ADMIN",
}

enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  FLAGGED = "FLAGGED",
}

enum LoanCategory {
  EDUCATION = "EDUCATION",
  PERSONAL = "PERSONAL",
  BUSINESS = "BUSINESS",
  MEDICAL = "MEDICAL",
  RENT = "RENT",
  TRAVEL = "TRAVEL",
  AGRICULTURE = "AGRICULTURE",
  UTILITIES = "UTILITIES",
  EMERGENCY = "EMERGENCY",
  OTHERS = "OTHERS",
  ASSET_PURCHASE = "ASSET_PURCHASE",
}

enum LoanStatus {
  PENDING = "PENDING",
  PREVIEW = "PREVIEW",
  REJECTED = "REJECTED",
  APPROVED = "APPROVED",
  DISBURSED = "DISBURSED",
  REPAID = "REPAID",
}

enum RepaymentStatus {
  AWAITING = "AWAITING",
  PARTIAL = "PARTIAL",
  FULFILLED = "FULFILLED",
  OVERPAID = "OVERPAID",
  FAILED = "FAILED",
  MANUAL_RESOLUTION = "MANUAL_RESOLUTION",
}

enum Gender {
  Female = "Female",
  Male = "Male",
}

enum MaritalStatus {
  Single = "Single",
  Married = "Married",
  Divorced = "Divorced",
  Widowed = "Widowed",
}

enum Relationship {
  Spouse = "Spouse",
  Parent = "Parent",
  Child = "Child",
  Sibling = "Sibling",
  Other = "Other",
}
