"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountOfficers } from "@/lib/queries/admin/account-officer";
import { assignAccountOfficer } from "@/lib/mutations/admin/customer";
import { useUserProvider } from "@/store/auth";

// The list endpoint's "Platform (Self-Signed)" entry; assigning it hands the customer back to the platform.
const PLATFORM_ID = "microbuilt-system-id";

/** Who manages the customer ("You" when it's the viewer). Super admins can reassign; everyone else sees the name. */
export function AccountOfficerField({
  customerId,
  officer,
  canAssign,
}: {
  customerId: string;
  officer: { id: string; name: string } | null;
  canAssign: boolean;
}) {
  const { user } = useUserProvider();
  const { data, isLoading } = useQuery({ ...accountOfficers, enabled: canAssign });
  const nameOf = (o: { id: string; name: string }) => (o.id === user?.id ? "You" : o.name);
  const assign = useMutation(assignAccountOfficer(customerId));
  const current = officer?.id ?? PLATFORM_ID;
  // Removed admins keep their customers until reassigned, so keep the current officer selectable.
  const options = (data?.data ?? []).filter((o) => o.isSystem || o.status !== "INACTIVE" || o.id === current);

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon icon={icons.userGroup} size={16} />
        Account officer
      </span>
      {canAssign ? (
        <Select
          value={current}
          onValueChange={(value) => value !== current && assign.mutate(value)}
          disabled={isLoading || assign.isPending}
        >
          <SelectTrigger
            className="h-8 max-w-[60%] min-w-0 text-sm data-[size=default]:h-8"
            aria-label="Assign account officer"
          >
            <SelectValue placeholder={officer ? nameOf(officer) : "Platform"} />
          </SelectTrigger>
          <SelectContent align="end">
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.isSystem ? "Platform (self-signed)" : nameOf(o)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{officer ? nameOf(officer) : "Platform"}</span>
      )}
    </div>
  );
}
