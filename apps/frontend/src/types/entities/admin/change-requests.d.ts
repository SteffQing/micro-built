type ChangeRequestKind = "IDENTITY" | "PAYMENT_METHOD" | "PROFILE" | "PAYROLL" | "ORGANIZATION";
type ChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** A change to someone's details waiting for (or decided by) an admin. */
type ChangeRequestDto = {
  id: string;
  kind: ChangeRequestKind;
  status: ChangeRequestStatus;
  user: { id: string; name: string; role: UserRole };
  /**
   * Only the fields being changed. PROFILE: name, email, phoneNumber (a photo changes at once). ORGANIZATION:
   * organizationId and organization (its name, for display).
   */
  proposed: Record<string, string | null>;
  /** The same fields as they were when the change was asked for. */
  previous: Record<string, string | null>;
  decidedBy: { id: string; name: string } | null;
  /** The admin who proposed it for the customer; null when the user asked themselves. */
  requestedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  note: string | null;
  canDecide: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuditAction =
  | "LOAN_APPROVED"
  | "LOAN_REJECTED"
  | "LOAN_DISBURSED"
  | "TOPUP_APPROVED"
  | "TOPUP_REJECTED"
  | "TOPUP_DISBURSED"
  | "PENALTY_APPLIED"
  | "TENURE_CHANGE_PROPOSED"
  | "TENURE_CHANGE_APPROVED"
  | "TENURE_CHANGE_REJECTED"
  | "PAYMENT_INFLOW_APPROVED"
  | "PAYMENT_INFLOW_REJECTED"
  | "VARIATION_GENERATED"
  | "VOUCHER_UPLOADED"
  | "VOUCHER_REVERTED"
  | "NO_PAYROLL"
  | "NO_PAYROLL_REVERTED"
  | "ORGANIZATIONS_MERGED"
  | "COMMODITY_APPROVED"
  | "COMMODITY_REJECTED"
  | "CUSTOMER_STATUS_CHANGED"
  | "CUSTOMER_OFFICER_CHANGED"
  | "ADMIN_INVITED"
  | "ADMIN_REMOVED"
  | "CHANGE_REQUEST_APPROVED"
  | "CHANGE_REQUEST_REJECTED"
  | "CHANGE_REQUEST_PROPOSED"
  | "SETTINGS_UPDATED"
  | "MAINTENANCE_TOGGLED"
  | "COMMODITY_ADDED"
  | "COMMODITY_UPDATED"
  | "COMMODITY_DELETED"
  | "ADMIN_ROLE_CHANGED"
  | "SIGN_IN_RESET"
  | "CUSTOMER_ONBOARDED"
  | "CUSTOMERS_IMPORTED"
  | "DATA_EXPORTED"
  | "DOCUMENT_GENERATED";

type AuditEntityType =
  | "LOAN"
  | "MICRO_LOAN"
  | "TENURE_CHANGE"
  | "PAYMENT_INFLOW"
  | "VARIATION"
  | "VOUCHER"
  | "ORGANIZATION"
  | "COMMODITY_LOAN"
  | "USER"
  | "CHANGE_REQUEST"
  | "SETTINGS"
  | "COMMODITY"
  | "FILE";

type AuditEntryDto = {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  /** The person a USER or LOAN entry is about. */
  entityLabel: string | null;
  note: string | null;
  meta: Record<string, unknown> | null;
  actor: { id: string; name: string; role: string };
  createdAt: string;
};

type AuditQuery = {
  actorId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  /** YYYY-MM-DD (Lagos days), inclusive */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};
