"use client";

import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganization, renameOrganization } from "@/lib/mutations/admin/organizations";
import { cn } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";
import { errorMessage } from "@/ui/variations/errors";

/**
 * Adds an organization (any admin), or renames one (SUPER_ADMIN, confirmed once per ten minutes). Names are matched
 * ignoring case and spaces, so a name another organization has is refused: merge into it instead.
 */
export function OrganizationNameDialog({
  organization,
  trigger,
  onSaved,
}: {
  /** Omitted to add a new one. */
  organization?: { id: string; name: string };
  trigger: ReactNode;
  onSaved?: (organization: OrganizationDto) => void;
}) {
  const renaming = !!organization;
  const superAdmin = useUserProvider().userRole === "SUPER_ADMIN";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(organization?.name ?? "");
  const [error, setError] = useState("");
  const create = useMutation(createOrganization);
  const rename = useMutation(renameOrganization(organization?.id ?? ""));
  const pending = create.isPending || rename.isPending;
  const trimmed = name.trim().replace(/\s+/g, " ");
  const unchanged = renaming && trimmed === organization.name;

  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setName(organization?.name ?? "");
      setError("");
    }
  }

  async function save() {
    setError("");
    try {
      const result = renaming ? await rename.mutateAsync(trimmed) : await create.mutateAsync(trimmed);
      changeOpen(false);
      if (result.data) onSaved?.(result.data);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-md">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon icon={renaming ? icons.edit : icons.building} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>{renaming ? `Rename ${organization.name}` : "Add an organization"}</DialogTitle>
              <DialogDescription>
                {renaming
                  ? "Variation files already sent keep the old name; new ones use this one."
                  : superAdmin
                    ? "An employer whose payroll deducts repayments. Customers join it when they're onboarded or moved."
                    : "An employer whose payroll deducts repayments. A super admin approves it before its variations can be generated."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form
          className={cn(dialogBodyClass, "pt-4")}
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && !unchanged && !pending) void save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="organization-name" className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input
              id="organization-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoComplete="off"
              placeholder="e.g. Nigerian Navy"
              aria-invalid={error ? true : undefined}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">Matched ignoring case and spaces: “NPF” and “npf ” are one organization.</p>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter className="border-t pt-4">
            <Button type="submit" disabled={!trimmed || unchanged} loading={pending}>
              {renaming ? "Save name" : "Add organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
