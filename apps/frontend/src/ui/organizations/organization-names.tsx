"use client";

import { useQuery } from "@tanstack/react-query";
import { organizationsList } from "@/lib/queries/admin/organizations";

/** The id an `<input list>` points at to suggest existing organization names. */
export const ORGANIZATION_NAMES_LIST = "organization-names";

/**
 * Suggestions for a free-text organization field. Forms that create a payroll record send the organization's name: an
 * existing one is reused, any other spelling creates a new organization, so suggesting the existing ones avoids
 * near-duplicates.
 */
export function OrganizationNameOptions() {
  const { data } = useQuery(organizationsList);
  return (
    <datalist id={ORGANIZATION_NAMES_LIST}>
      {(data?.data ?? []).map((organization) => (
        <option key={organization.id} value={organization.name} />
      ))}
    </datalist>
  );
}
