"use client";

import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { mergeOrganization } from "@/lib/mutations/admin/organizations";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/ui/variations/errors";
import { OrganizationSelect } from "@/ui/variations/organization-select";

/**
 * SUPER_ADMIN, confirmed with a code or passkey: folds an organization that was spelled differently into the right one.
 * Its customers and variations move across and it disappears.
 */
export function MergeOrganizationDialog({
  organization,
  trigger,
  onMerged,
}: {
  organization: { id: string; name: string };
  trigger: ReactNode;
  /** Called with the id of the organization everything moved into. */
  onMerged: (intoId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [intoId, setIntoId] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const { mutateAsync, isPending } = useMutation(mergeOrganization(organization.id));

  function changeOpen(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setIntoId("");
      setAcknowledged(false);
      setError("");
    }
  }

  async function merge() {
    setError("");
    try {
      await mutateAsync(intoId);
      changeOpen(false);
      onMerged(intoId);
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
              <Icon icon={icons.shieldAlert} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>Merge {organization.name}</DialogTitle>
              <DialogDescription>You&apos;ll confirm it with your authenticator code or a passkey.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form
          className={cn(dialogBodyClass, "pt-4")}
          onSubmit={(e) => {
            e.preventDefault();
            if (intoId && acknowledged && !isPending) void merge();
          }}
        >
          <ul className="grid gap-1.5 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            <li>Use this when one employer was entered under two spellings.</li>
            <li>Its customers and variations (with their vouchers) move to the organization you pick, and {organization.name} is deleted.</li>
            <li>Refused when both have a variation for the same month.</li>
          </ul>
          <div className="grid gap-1.5">
            <Label htmlFor="merge-into" className="text-xs text-muted-foreground">
              Merge into
            </Label>
            <OrganizationSelect id="merge-into" value={intoId} onChange={setIntoId} exclude={organization.id} />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="merge-ack"
              className="mt-0.5"
              checked={acknowledged}
              disabled={isPending}
              onCheckedChange={(value) => setAcknowledged(value === true)}
            />
            <Label htmlFor="merge-ack" className="font-normal">
              I understand this can&apos;t be undone
            </Label>
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
            <Button type="submit" variant="destructive" disabled={!intoId || !acknowledged} loading={isPending}>
              Merge organizations
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
