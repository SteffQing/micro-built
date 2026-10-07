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
import { deleteOrganization } from "@/lib/mutations/admin/organizations";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/ui/variations/errors";

/**
 * SUPER_ADMIN, confirmed once per ten minutes: deletes an organization nothing uses yet. One with customers, variations
 * or pending moves into it is refused (the message says which): merge it into another instead.
 */
export function DeleteOrganizationDialog({
  organization,
  trigger,
  onDeleted,
}: {
  organization: OrganizationDto;
  trigger: ReactNode;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const { mutateAsync, isPending } = useMutation(deleteOrganization(organization.id));
  const inUse = organization.customers > 0;

  function changeOpen(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) setError("");
  }

  async function remove() {
    setError("");
    try {
      await mutateAsync();
      changeOpen(false);
      onDeleted();
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
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <Icon icon={icons.delete} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>Delete {organization.name}</DialogTitle>
              <DialogDescription>Only an organization nothing uses yet can be deleted.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={cn(dialogBodyClass, "pt-4")}>
          <p className="text-sm text-muted-foreground">
            {inUse
              ? `${organization.name} has ${organization.customers} ${organization.customers === 1 ? "customer" : "customers"}, so it can't be deleted. If it's another spelling of an employer, merge it into that one instead.`
              : `${organization.name} has no customers. It's removed for good.`}
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="destructive" disabled={inUse} loading={isPending} onClick={() => void remove()}>
              Delete organization
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
