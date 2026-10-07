"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { organizationsList } from "@/lib/queries/admin/organizations";
import { cn } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";

/** What the API matches names on: "Nigerian  Navy " and "nigerian navy" are one organization. */
const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
const tidy = (name: string) => name.trim().replace(/\s+/g, " ");

/**
 * Picks the organization a customer's payroll is in, by name (what the forms send). One we support is picked from the
 * list; any other name can be added. A super admin's new name is created as it is; anyone else's waits for a super
 * admin to approve it, with the customer already in it. `newHint` replaces that note where someone else decides
 * (e.g. a change request).
 */
export function OrganizationNamePicker({
  id,
  value,
  onChange,
  invalid,
  className,
  newHint,
}: {
  id?: string;
  value: string;
  onChange: (name: string) => void;
  invalid?: boolean;
  className?: string;
  newHint?: string;
}) {
  const { userRole } = useUserProvider();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery(organizationsList);
  const organizations = data?.data ?? [];

  const picked = organizations.find((o) => normalize(o.name) === normalize(value));
  const typed = tidy(search);
  const typedExists = organizations.some((o) => normalize(o.name) === normalize(typed));
  const isNew = Boolean(value.trim()) && !picked && !isLoading;
  const hint =
    newHint ??
    (userRole === "SUPER_ADMIN"
      ? "It's added as a new organization."
      : "It's added as a new organization once a super admin approves it. The customer joins it meanwhile.");

  function choose(name: string) {
    onChange(name);
    setSearch("");
    setOpen(false);
  }

  return (
    <div className="grid gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              invalid && "border-destructive",
              className,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon icon={icons.building} size={16} className="shrink-0 text-muted-foreground" />
              <span className="truncate">{picked?.name ?? (value || "Pick or add an organization")}</span>
              {(isNew || picked?.status === "PENDING") && (
                <span className="shrink-0 rounded-md bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                  {isNew ? "New" : "Awaiting approval"}
                </span>
              )}
            </span>
            <Icon icon={icons.chevronDown} size={14} className="shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search or type a new name…" value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{isLoading ? "Loading organizations…" : "No organization by that name"}</CommandEmpty>
              {organizations.length > 0 && (
                <CommandGroup heading="Organizations">
                  {organizations.map((organization) => (
                    <CommandItem key={organization.id} value={organization.name} onSelect={() => choose(organization.name)}>
                      <Icon
                        icon={icons.check}
                        size={16}
                        className={cn(picked?.id === organization.id ? "opacity-100" : "opacity-0")}
                      />
                      <span className="truncate">{organization.name}</span>
                      {organization.status === "PENDING" && (
                        <span className="ml-auto text-[11px] text-warning">Awaiting approval</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {typed && !typedExists && (
                <CommandGroup heading="New">
                  {/* cmdk filters on `value`: the search text itself always matches. */}
                  <CommandItem value={`add ${typed}`} keywords={[typed]} onSelect={() => choose(typed)}>
                    <Icon icon={icons.plus} size={16} />
                    <span className="truncate">Add “{typed}”</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {isNew && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
