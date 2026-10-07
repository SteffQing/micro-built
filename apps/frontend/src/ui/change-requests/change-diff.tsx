"use client";

import { format } from "date-fns";

// How a change request reads: each changed field as "old → new", in words people use.

const FIELD_LABELS: Record<string, string> = {
  // Profile
  name: "Name",
  email: "Email",
  phoneNumber: "Phone number",
  // Payment method
  bankName: "Bank",
  accountNumber: "Account number",
  accountName: "Account name",
  bvn: "BVN",
  // Identity
  dateOfBirth: "Date of birth",
  gender: "Gender",
  maritalStatus: "Marital status",
  residencyAddress: "Address",
  stateResidency: "State of residence",
  landmarkOrBusStop: "Landmark / bus stop",
  nextOfKinName: "Next of kin",
  nextOfKinContact: "Next of kin phone",
  nextOfKinAddress: "Next of kin address",
  nextOfKinRelationship: "Next of kin relationship",
  // Payroll
  externalId: "IPPIS number",
  organization: "Organization",
  organizationId: "Organization",
  command: "Command",
  grade: "Grade",
  step: "Step",
};

export const KIND_LABELS: Record<ChangeRequestKind, string> = {
  IDENTITY: "Identity details",
  PAYMENT_METHOD: "Payment method",
  PROFILE: "Profile",
  PAYROLL: "Payroll details",
  ORGANIZATION: "Organization",
};

export function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key;
}

/**
 * The fields a request changes, as people read them. A change of organization carries the id and the name: only the
 * name is shown.
 */
export function changedKeys(proposed: Record<string, string | null>) {
  const keys = Object.keys(proposed);
  return "organization" in proposed ? keys.filter((key) => key !== "organizationId") : keys;
}

function display(key: string, value: string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "dateOfBirth") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : format(date, "d MMM yyyy");
  }
  return value;
}

/** The API sends everyone but super admins dots in place of a BVN. */
function hiddenBvn(key: string, value: string | null | undefined) {
  return key === "bvn" && typeof value === "string" && /^•+$/.test(value);
}

/** The changed fields of a request, old value struck through beside the new one. */
export function ChangeDiff({ request }: { request: Pick<ChangeRequestDto, "proposed" | "previous"> }) {
  const keys = changedKeys(request.proposed);
  return (
    <dl className="grid gap-2 text-sm">
      {keys.map((key) => (
        <div key={key} className="grid grid-cols-1 gap-1 sm:grid-cols-[10rem_1fr] sm:gap-3">
          <dt className="text-muted-foreground">{fieldLabel(key)}</dt>
          {hiddenBvn(key, request.proposed[key]) ? (
            <dd className="text-muted-foreground">
              {hiddenBvn(key, request.previous[key]) ? "Changes" : "Added"} (only super admins see BVNs)
            </dd>
          ) : (
            <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-muted-foreground line-through wrap-anywhere">
                {display(key, request.previous[key])}
              </span>
              <span aria-hidden className="text-muted-foreground">→</span>
              <span className="sr-only">changes to</span>
              <strong className="font-medium text-foreground wrap-anywhere">
                {display(key, request.proposed[key])}
              </strong>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
