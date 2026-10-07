"use client";

import { useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { escalate } from "@/lib/mutations/marketer";
import { marketerAdmins } from "@/lib/queries/marketer";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/ui/variations/errors";

const EVERYONE = "everyone";

const STAGE_COPY: Record<EscalationStage, { waits: string; everyone: string }> = {
  DECISION: { waits: "waiting for an admin to approve it", everyone: "Every admin" },
  DISBURSEMENT: { waits: "approved and waiting for a super admin to disburse it", everyone: "Every super admin" },
};

/** "2 hours ago" for an escalation, or null. */
export function escalatedAgo(at: string | null): string | null {
  return at ? formatDistanceToNow(new Date(at), { addSuffix: true }) : null;
}

/**
 * Asks one admin, or everyone who can act on it now, to look at a customer's loan, asset request or top-up. Marketers
 * can't approve or disburse: this is how they move it on. Each admin is asked at most once a day about it.
 */
export function EscalateDialog({
  kind,
  id,
  stage,
  lastEscalatedAt,
  what,
  trigger,
}: {
  kind: EscalationKind;
  id: string;
  stage: EscalationStage;
  lastEscalatedAt: string | null;
  /** "Ada Obi's education loan", for the title. */
  what: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [adminId, setAdminId] = useState(EVERYONE);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const admins = useQuery({ ...marketerAdmins, enabled: open });
  const send = useMutation(escalate);
  // Only a super admin disburses, so only they can be asked once it waits for disbursement.
  const choices = (admins.data?.data ?? []).filter((admin) => stage === "DECISION" || admin.role === "SUPER_ADMIN");
  const copy = STAGE_COPY[stage];
  const ago = escalatedAgo(lastEscalatedAt);

  function changeOpen(next: boolean) {
    if (send.isPending) return;
    setOpen(next);
    if (!next) {
      setAdminId(EVERYONE);
      setNote("");
      setError("");
    }
  }

  async function submit() {
    setError("");
    try {
      await send.mutateAsync({
        kind,
        id,
        ...(adminId !== EVERYONE && { adminId }),
        ...(note.trim() && { note: note.trim() }),
      });
      changeOpen(false);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="h-8 gap-1.5">
            <Icon icon={icons.arrowUpRight} size={14} />
            Escalate
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-md">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon icon={icons.arrowUpRight} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>Escalate {what}</DialogTitle>
              <DialogDescription>
                It is {copy.waits}. They get it in the app and by email.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form
          className={cn(dialogBodyClass, "pt-4")}
          onSubmit={(e) => {
            e.preventDefault();
            if (!send.isPending) void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`escalate-admin-${id}`} className="text-xs text-muted-foreground">
              Who to ask
            </Label>
            <Select value={adminId} onValueChange={setAdminId} disabled={send.isPending}>
              <SelectTrigger id={`escalate-admin-${id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERYONE}>{copy.everyone}</SelectItem>
                {choices.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.name}
                    <span className="text-muted-foreground">
                      {" "}
                      · {admin.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {admins.isLoading && <p className="text-xs text-muted-foreground">Loading admins…</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`escalate-note-${id}`} className="text-xs text-muted-foreground">
              Note (optional)
            </Label>
            <Textarea
              id={`escalate-note-${id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Anything that helps them decide, e.g. why it's urgent"
              disabled={send.isPending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {ago ? `You last escalated this ${ago}. ` : ""}Each admin is asked at most once a day about it.
          </p>
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="border-t pt-4">
            <Button type="submit" loading={send.isPending}>
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
