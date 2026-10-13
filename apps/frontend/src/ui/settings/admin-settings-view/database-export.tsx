"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestDatabaseExport } from "@/lib/mutations/admin/superadmin";
import { cn } from "@/lib/utils";
import { SettingRow } from "./setting-row";

const MIN_REASON = 5;
const MIN_PASSWORD = 12;

/**
 * The whole database as one workbook that opens only with a password the super admin picks here. Asks why (audit
 * log), then the code or passkey; the link arrives in their notifications and works for an hour.
 */
function DatabaseExportForm({ onDone }: { onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const exportDb = useMutation(requestDatabaseExport);

  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = reason.trim().length >= MIN_REASON && password.length >= MIN_PASSWORD && confirm === password;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || exportDb.isPending) return;
        exportDb.mutate({ reason: reason.trim(), password }, { onSuccess: onDone });
      }}
    >
      <ul className="grid gap-1.5 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
        <li>Every customer, loan, payment and admin record, as an Excel file with a sheet per table.</li>
        <li>It opens only with the password you set below. We don&apos;t keep it: if you lose it, export again.</li>
        <li>The link comes to your notifications, works for 1 hour, then the file is deleted.</li>
        <li>Recorded in the audit log, and every other super admin is told.</li>
      </ul>
      <div className="grid gap-1.5">
        <Label htmlFor="db-export-reason">Why are you exporting the database?</Label>
        <Textarea
          id="db-export-reason"
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Quarterly offline backup for the auditors"
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">Kept in the audit log and in the file.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="db-export-password">File password</Label>
        <div className="relative">
          <Input
            id="db-export-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pe-9"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 end-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground"
          >
            <Icon icon={show ? icons.eyeOff : icons.view} size={16} />
          </button>
        </div>
        <p className={cn("text-xs", password && password.length < MIN_PASSWORD ? "text-destructive" : "text-muted-foreground")}>
          At least {MIN_PASSWORD} characters.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="db-export-confirm">Type it again</Label>
        <Input
          id="db-export-confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          maxLength={128}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch}
        />
        {mismatch && <p className="text-xs text-destructive">The passwords don&apos;t match.</p>}
      </div>
      <Button type="submit" variant="destructive" disabled={!ready} loading={exportDb.isPending} className="justify-self-end">
        <Icon icon={icons.download} size={14} />
        Export database
      </Button>
    </form>
  );
}

export function DatabaseExportControl() {
  const [open, setOpen] = useState(false);
  return (
    <SettingRow
      title="Export database"
      description="Download everything in one password-protected file. Recorded in the audit log."
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Icon icon={icons.download} size={14} />
            Export
          </Button>
        </DialogTrigger>
        <DialogContent className="grid-cols-1 gap-0 sm:max-w-md">
          <DialogHeader className="border-b">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <Icon icon={icons.shieldAlert} size={20} />
              </span>
              <div className="min-w-0 text-left">
                <DialogTitle>Export the whole database</DialogTitle>
                <DialogDescription>Everyone&apos;s data, in one file. Handle it with care.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {/* Remounted each time it opens, so a password never lingers in a closed dialog. */}
          <div className={cn(dialogBodyClass, "pt-4")}>{open && <DatabaseExportForm onDone={() => setOpen(false)} />}</div>
        </DialogContent>
      </Dialog>
    </SettingRow>
  );
}
