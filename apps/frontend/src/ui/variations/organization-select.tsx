"use client";

import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { organizationsList } from "@/lib/queries/admin/organizations";
import { cn } from "@/lib/utils";

/** Value of the "All organizations" option. */
export const ALL_ORGANIZATIONS = "all";

/** The organizations from `GET /admin/organizations`, A–Z, as a select. */
export function OrganizationSelect({
  value,
  onChange,
  allowAll = false,
  allLabel = "All organizations",
  exclude,
  placeholder = "Choose an organization",
  id,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Adds "All organizations" (value `all`) at the top. */
  allowAll?: boolean;
  allLabel?: string;
  /** Left out of the list (the organization a customer is already in, the one being merged away). */
  exclude?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { data, isLoading, isError } = useQuery(organizationsList);
  const organizations = (data?.data ?? []).filter((organization) => organization.id !== exclude);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger id={id} className={cn("w-full", className)} aria-label="Organization">
        <SelectValue placeholder={isLoading ? "Loading organizations…" : isError ? "Could not load them" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value={ALL_ORGANIZATIONS}>{allLabel}</SelectItem>}
        {organizations.map((organization) => (
          <SelectItem key={organization.id} value={organization.id}>
            {organization.name}
          </SelectItem>
        ))}
        {organizations.length === 0 && !allowAll && !isLoading && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No organizations yet</div>
        )}
      </SelectContent>
    </Select>
  );
}
