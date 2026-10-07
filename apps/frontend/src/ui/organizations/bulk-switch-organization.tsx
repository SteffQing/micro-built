"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { requestOrganizationSwitch } from "@/lib/mutations/admin/organizations";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/ui/variations/errors";
import { OrganizationSelect } from "@/ui/variations/organization-select";
import { OUTCOME_LABELS } from "./switch-organization";

/** The API takes this many ids in one go. */
const MAX_IDS = 500;

/** IPPIS ids pasted from a sheet: split on lines, commas, semicolons and spaces; each id once, in order. */
function parseIds(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((id) => id.trim()).filter(Boolean))];
}

/**
 * Asks to move many customers into one organization, from a pasted column of IPPIS / staff ids or a one-column .csv or
 * .txt file. Each id becomes an ORGANIZATION change request for a super admin to approve, and each comes back with its
 * own outcome.
 */
export function BulkSwitchOrganizationDialog() {
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [text, setText] = useState("");
  const [results, setResults] = useState<OrganizationSwitchResultDto["results"] | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const { mutateAsync, isPending } = useMutation(requestOrganizationSwitch(organizationId));

  const ids = parseIds(text);
  const tooMany = ids.length > MAX_IDS;

  function changeOpen(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setOrganizationId("");
      setText("");
      setResults(null);
      setError("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error("Choose a .csv or .txt file, or paste the column from your sheet");
      return;
    }
    const lines = (await file.text()).split(/\r?\n/).map((line) => line.split(",")[0].trim());
    // A header cell ("IPPIS number") has no digits; ids do.
    const body = lines.length > 1 && lines[0] && !/\d/.test(lines[0]) ? lines.slice(1) : lines;
    setText(body.filter(Boolean).join("\n"));
    setResults(null);
  }

  async function submit() {
    setError("");
    try {
      const response = await mutateAsync(ids);
      setResults(response.data?.results ?? []);
      toast.success(response.message);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  const counts = results
    ? (Object.keys(OUTCOME_LABELS) as OrganizationSwitchOutcome[]).map((outcome) => ({
        outcome,
        count: results.filter((result) => result.outcome === outcome).length,
      }))
    : [];

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Icon icon={icons.building} size={16} />
          Switch organization
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto rounded-lg sm:max-w-[520px]">
        <DialogHeader className="border-b">
          <DialogTitle>Switch many customers&apos; organization</DialogTitle>
          <DialogDescription>
            One request per customer, each approved by a super admin before anything moves.
          </DialogDescription>
        </DialogHeader>

        <div className={cn(dialogBodyClass, "min-w-0 pt-4")}>
          {!results ? (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (organizationId && ids.length > 0 && !tooMany && !isPending) void submit();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="bulk-switch-organization" className="text-xs text-muted-foreground">
                  Move them into
                </Label>
                <OrganizationSelect id="bulk-switch-organization" value={organizationId} onChange={setOrganizationId} />
              </div>

              <div className="grid gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="bulk-switch-ids" className="text-xs text-muted-foreground">
                    IPPIS / staff IDs
                  </Label>
                  <input ref={fileInput} type="file" accept=".csv,.txt" className="hidden" onChange={readFile} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Icon icon={icons.upload} size={14} />
                    From a .csv or .txt file
                  </Button>
                </div>
                <Textarea
                  id="bulk-switch-ids"
                  rows={7}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={"One ID per line, or paste the column from your sheet\n1234567\n7654321"}
                  className="font-mono text-sm"
                />
                <p className={cn("text-xs", tooMany ? "text-destructive" : "text-muted-foreground")}>
                  {tooMany
                    ? `${ids.length} IDs: send at most ${MAX_IDS} at a time.`
                    : `${ids.length} ${ids.length === 1 ? "ID" : "IDs"} found, repeats counted once.`}
                </p>
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
                <Button type="submit" disabled={!organizationId || ids.length === 0 || tooMany} loading={isPending}>
                  Send {ids.length > 0 ? `${ids.length} ` : ""}for approval
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {counts
                  .filter((item) => item.count > 0)
                  .map((item) => (
                    <span
                      key={item.outcome}
                      className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", OUTCOME_LABELS[item.outcome].tone)}
                    >
                      {OUTCOME_LABELS[item.outcome].label}: {item.count}
                    </span>
                  ))}
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((result) => (
                      <tr key={result.externalId}>
                        <td className="px-3 py-2 font-mono text-xs">{result.externalId}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              OUTCOME_LABELS[result.outcome].tone,
                            )}
                          >
                            {OUTCOME_LABELS[result.outcome].label}
                          </span>
                          {result.requestId && result.outcome !== "CREATED" && (
                            <Link
                              href={`/approvals?request=${result.requestId}`}
                              className="ml-2 text-xs font-medium text-brand hover:underline"
                            >
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setResults(null)}>
                  Send more
                </Button>
                <Button type="button" onClick={() => changeOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
