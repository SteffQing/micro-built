"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";
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
import { Switch } from "@/components/ui/switch";
import { exportStatement } from "@/lib/mutations/user/statement";
import { cn } from "@/lib/utils";

type Format = "pdf" | "xlsx";

const FORMATS: { value: Format; label: string; icon: typeof icons.file }[] = [
  { value: "pdf", label: "PDF", icon: icons.file },
  { value: "xlsx", label: "Excel", icon: icons.fileSpreadsheet },
];

/**
 * The customer's own statement as a file: the months it covers, PDF or Excel, and whether it's password-protected
 * (on by default: it opens with their customer ID). The link arrives in-app and by email.
 */
export function ExportStatementDialog({ defaultPeriod }: { defaultPeriod?: PeriodRangeValue }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodRangeValue>(defaultPeriod ?? { from: "", to: "" });
  const [format, setFormat] = useState<Format>("pdf");
  const [protect, setProtect] = useState(true);
  const exportMut = useMutation(exportStatement);

  function changeOpen(next: boolean) {
    if (exportMut.isPending) return;
    setOpen(next);
    if (next) {
      setPeriod(defaultPeriod ?? { from: "", to: "" });
      setFormat("pdf");
      setProtect(true);
    }
  }

  function submit() {
    exportMut.mutate(
      {
        format,
        protect,
        ...(period.from && { from: period.from }),
        ...(period.to && { to: period.to }),
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5">
          <Icon icon={icons.download} size={16} />
          Export statement
        </Button>
      </DialogTrigger>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-md">
        <DialogHeader className="border-b">
          <DialogTitle>Export statement</DialogTitle>
          <DialogDescription>We&apos;ll notify you and email you a link when the file is ready.</DialogDescription>
        </DialogHeader>
        <div className={cn(dialogBodyClass, "gap-5 pt-4")}>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Period</Label>
            <PeriodRangeFilter value={period} onChange={setPeriod} />
            <p className="text-xs text-muted-foreground">
              {period.from || period.to ? "Only these months are included." : "Leave it empty for your whole history."}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Format</Label>
            <div role="radiogroup" aria-label="File format" className="grid grid-cols-2 gap-2">
              {FORMATS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={format === option.value}
                  onClick={() => setFormat(option.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    format === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                  )}
                >
                  <Icon icon={option.icon} size={16} className="text-muted-foreground" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <Label htmlFor="statement-protect" className="grid gap-0.5 text-sm font-normal leading-snug">
              Password-protect the file
              <span className="text-xs text-muted-foreground">
                {protect
                  ? "It opens with your customer ID (it starts with MB- and is on your profile)."
                  : "Anyone with the file can open it."}
              </span>
            </Label>
            <Switch id="statement-protect" checked={protect} onCheckedChange={setProtect} />
          </div>

          <DialogFooter className="border-t pt-4">
            <Button type="button" loading={exportMut.isPending} onClick={submit}>
              <Icon icon={icons.download} size={16} />
              Export {format === "pdf" ? "PDF" : "Excel"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
