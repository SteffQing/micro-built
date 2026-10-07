"use client";

import { useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { uploadVoucher, validateVoucher } from "@/lib/mutations/admin/repayments";
import { cn } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";
import { errorMessage } from "@/ui/variations/errors";
import { monthName } from "@/ui/variations/format";
import { OrganizationSelect } from "@/ui/variations/organization-select";

type DialogStep = "select" | "validating" | "results";

const sheetTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

/**
 * An organization's repayment file (its voucher) for a month. The organization is picked here: the sheet's own
 * organization column isn't read. Validate first: it shows the variation the voucher lands in and the rows that would
 * need an admin afterwards. Uploading locks that variation. Vouchers go in month order: an earlier month still waiting
 * blocks the upload (it isn't offered "No payroll" here; that's done, deliberately, from its own variation).
 */
export default function UploadVoucher({
  defaultOrganizationId = "",
  trigger,
  onUploaded,
}: {
  defaultOrganizationId?: string;
  trigger?: ReactNode;
  onUploaded?: () => void;
}) {
  const { userRole } = useUserProvider();
  const [isOpen, setIsOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState(defaultOrganizationId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<DialogStep>("select");
  const [validationResult, setValidationResult] = useState<RepaymentValidationResult | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { mutateAsync: validateAsync, isPending: isValidating } = useMutation(validateVoucher);
  const { mutateAsync: uploadAsync, isPending: isUploading } = useMutation(uploadVoucher);

  function reset() {
    setOrganizationId(defaultOrganizationId);
    setSelectedFile(null);
    setStep("select");
    setValidationResult(null);
    setAcknowledged(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function changeOpen(next: boolean) {
    if (isUploading) return;
    setIsOpen(next);
    if (!next) reset();
  }

  function backToSelect() {
    setStep("select");
    setValidationResult(null);
    setAcknowledged(false);
    setError("");
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isXlsx = sheetTypes.includes(file.type) || file.name.toLowerCase().endsWith(".xlsx");
    if (!isXlsx) {
      toast.error("Please select a valid .xlsx file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }
    setSelectedFile(file);
    setValidationResult(null);
    setStep("select");
  };

  const handleValidate = async () => {
    if (!selectedFile || !organizationId) return;
    setStep("validating");
    setError("");
    try {
      const result = await validateAsync({ file: selectedFile, organizationId });
      setValidationResult(result.data ?? null);
      setAcknowledged(false);
      setStep("results");
    } catch {
      setStep("select");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !organizationId) return;
    setError("");
    try {
      await uploadAsync({ file: selectedFile, organizationId });
      onUploaded?.();
      setIsOpen(false);
      reset();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  const result = validationResult;
  const issueTotal = result ? result.issues.unmatched + result.issues.otherOrganization + result.issues.notInVariation : 0;
  const mostlyIssues = Boolean(result && result.rows > 0 && issueTotal > result.rows / 2);
  // An earlier month still waiting for its voucher is one of the conflicts.
  const blockers = result ? [...new Set([...(result.valid ? [] : result.problems), ...result.conflicts])] : [];
  const sheetOk = Boolean(result && result.missingColumns.length === 0 && result.invalidRows.length === 0);
  const canUpload =
    Boolean(result) &&
    sheetOk &&
    blockers.length === 0 &&
    result!.variation !== null &&
    (issueTotal === 0 || acknowledged);

  const dialogTitle =
    step === "select" ? "Upload voucher" : step === "validating" ? "Validating file…" : "Validation results";

  return (
    <Dialog open={isOpen} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" disabled={userRole !== "SUPER_ADMIN"}>
            Upload voucher
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={step === "results" ? "sm:max-w-[560px]" : "sm:max-w-[425px]"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "results" && (
              <button
                type="button"
                onClick={backToSelect}
                aria-label="Back"
                className="cursor-pointer rounded-md p-0.5 transition-colors hover:bg-muted"
              >
                <Icon icon={icons.arrowLeft} size={16} />
              </button>
            )}
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        <Separator className="bg-border" />

        {/* Step 1: organization and file */}
        {(step === "select" || step === "validating") && (
          <section className="grid gap-4 p-4 sm:gap-5 sm:p-5">
            <p className="text-sm font-normal text-muted-foreground">
              A voucher is one organization&apos;s repayment file for a month. It is matched to that organization&apos;s
              variation for the month in the sheet&apos;s Period column, and locks it.
            </p>

            <div className="grid gap-1.5">
              <Label htmlFor="voucher-organization" className="text-sm font-medium text-foreground">
                Organization
              </Label>
              <OrganizationSelect
                id="voucher-organization"
                value={organizationId}
                onChange={setOrganizationId}
                disabled={isValidating}
              />
              <p className="text-xs text-muted-foreground">
                The organization column in the sheet isn&apos;t used: pick whose file this is.
              </p>
            </div>

            <div className="flex flex-col gap-5 rounded-[8px] border border-border p-3">
              <Label className="text-sm font-medium text-foreground" htmlFor="voucher-upload-input">
                File <span className="text-xs font-normal text-muted-foreground">XLSX</span>
              </Label>

              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="hidden"
                id="voucher-upload-input"
              />

              {selectedFile ? (
                <Button
                  type="button"
                  className="max-h-12 gap-2 rounded-[4px] border border-success/30 bg-success/10 p-2.5 text-xs font-normal text-success disabled:opacity-100"
                  disabled
                >
                  <Icon icon={icons.file} size={16} className="mr-2" />
                  <span className="max-w-[20ch] truncate">{selectedFile.name}</span>
                  <span className="text-foreground">{`(${(selectedFile.size / 1024).toFixed(2)} KB)`}</span>
                  <Icon icon={icons.checkCircle} size={16} />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="max-h-12 gap-1 rounded-[8px] border border-border bg-muted p-2.5 text-xs font-normal text-muted-foreground"
                  disabled={isValidating}
                >
                  <Icon icon={icons.upload} size={16} className="mr-2" />
                  Choose file
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Step 2: what the voucher would do */}
        {step === "results" && result && (
          <section className="grid gap-4 p-4 sm:p-5">
            <div className="flex items-center gap-2 rounded-[8px] border border-border bg-muted p-2.5">
              <Icon icon={icons.fileSpreadsheet} size={16} className="shrink-0 text-foreground" />
              <span className="min-w-0 truncate text-xs text-foreground">{selectedFile?.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                ({((selectedFile?.size ?? 0) / 1024).toFixed(1)} KB)
              </span>
            </div>

            {/* Where it lands */}
            <div
              className={cn(
                "rounded-[8px] border p-3",
                result.variation ? "border-border bg-card" : "border-destructive/30 bg-destructive/10",
              )}
            >
              <p className="text-xs text-muted-foreground">Lands in</p>
              <p className="mt-0.5 text-sm font-semibold">
                {result.organization.name}
                {" · "}
                {result.period ? monthName(result.period) : "month not found in the sheet"}
              </p>
              <p className={cn("mt-1 text-xs", result.variation ? "text-muted-foreground" : "text-destructive")}>
                {result.variation
                  ? `Variation version ${result.variation.version}. Uploading locks it: its deductions are settled against this file.`
                  : "There is no variation for this month yet. Generate it first, then upload the voucher."}
              </p>
            </div>

            {/* Sheet-level problems and refusals the columns and rows can't show */}
            {blockers.length > 0 && (
              <div className="flex items-start gap-2 rounded-[8px] border border-destructive/30 bg-destructive/10 p-3">
                <Icon icon={icons.alertTriangle} size={16} className="mt-0.5 shrink-0 text-destructive" />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-destructive">This file can&apos;t be uploaded yet</p>
                  <ul className="space-y-0.5 text-xs text-destructive">
                    {blockers.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Rows that would need an admin afterwards */}
            <div
              className={cn(
                "rounded-[8px] border p-3",
                issueTotal === 0 ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10",
              )}
            >
              <p className={cn("text-sm font-medium", issueTotal === 0 ? "text-success" : "text-warning")}>
                {issueTotal === 0
                  ? `All ${result.rows} rows match a loan in the variation.`
                  : `${issueTotal} of ${result.rows} rows would need an admin`}
              </p>
              {issueTotal > 0 && (
                <>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "No such staff ID", value: result.issues.unmatched },
                      { label: "In another organization", value: result.issues.otherOrganization },
                      { label: "Loan not in the variation", value: result.issues.notInVariation },
                    ].map((item) => (
                      <div key={item.label} className="rounded-md border bg-card px-2 py-1.5">
                        <dd className="text-lg font-semibold tabular-nums">{item.value}</dd>
                        <dt className="text-[11px] leading-tight text-muted-foreground">{item.label}</dt>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-xs text-muted-foreground">
                    They land in Inflows to resolve by hand. Until then their borrowers are treated as unpaid: failed and
                    charged when the voucher locks the month (rematching clears the charge).
                  </p>
                  {mostlyIssues && (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      More than half the rows would be issues. Check this is {result.organization.name}&apos;s file: the wrong
                      organization charges everyone in its variation.
                    </p>
                  )}
                </>
              )}
            </div>

            <ValidationSection title="Header Validation" valid={result.missingColumns.length === 0}>
              {result.missingColumns.length === 0 ? (
                <p className="text-xs text-foreground">All required headers are present.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-destructive">Missing required headers:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingColumns.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 font-mono text-xs text-destructive"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </ValidationSection>

            <ValidationSection
              title="Row Validation"
              valid={result.invalidRows.length === 0}
              subtitle={`${result.rows} rows parsed`}
            >
              {result.invalidRows.length === 0 ? (
                <p className="text-xs text-foreground">All {result.rows} rows are valid.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-warning">
                    <span className="font-semibold">{result.invalidRows.length}</span> of {result.rows} rows have issues
                  </p>
                  <div className="max-h-[200px] max-w-full overflow-auto rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="border-b border-border px-3 py-2 text-left font-medium text-foreground">Row</th>
                          <th className="border-b border-border px-3 py-2 text-left font-medium text-foreground">Staff ID</th>
                          <th className="border-b border-border px-3 py-2 text-left font-medium text-foreground">Issues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.invalidRows.map((row, index) => (
                          <tr key={index} className="border-b border-border transition-colors last:border-0 hover:bg-muted">
                            <td className="px-3 py-2 font-mono text-foreground tabular-nums">{row.row}</td>
                            <td className="px-3 py-2 font-mono text-foreground">{row.staffId || "—"}</td>
                            <td className="px-3 py-2">
                              <ul className="space-y-0.5">
                                {row.issues.map((issue, i) => (
                                  <li key={i} className="flex items-start gap-1 text-destructive">
                                    <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
                                    {issue}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </ValidationSection>

            {issueTotal > 0 && sheetOk && blockers.length === 0 && result.variation && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="voucher-ack"
                  className="mt-0.5"
                  checked={acknowledged}
                  disabled={isUploading}
                  onCheckedChange={(value) => setAcknowledged(value === true)}
                />
                <Label htmlFor="voucher-ack" className="font-normal">
                  This is {result.organization.name}&apos;s file; I&apos;ll resolve the {issueTotal}{" "}
                  {issueTotal === 1 ? "row" : "rows"} afterwards
                </Label>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}

          </section>
        )}

        <DialogFooter>
          {step === "select" || step === "validating" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => changeOpen(false)}
                disabled={isValidating}
                className="flex-1 rounded-[8px] bg-muted p-2.5 text-sm font-medium text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="btn-gradient flex-1 rounded-[8px] p-2.5 text-sm font-medium text-primary-foreground"
                onClick={handleValidate}
                loading={isValidating}
                disabled={!selectedFile || !organizationId || isValidating}
              >
                <Icon icon={icons.shield} size={16} />
                Validate
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  backToSelect();
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={isUploading}
                className="flex-1 rounded-[8px] bg-muted p-2.5 text-sm font-medium text-muted-foreground"
              >
                Choose another file
              </Button>
              <Button
                type="button"
                className="btn-gradient flex-1 rounded-[8px] p-2.5 text-sm font-medium text-primary-foreground"
                onClick={handleUpload}
                loading={isUploading}
                disabled={!canUpload || isUploading}
              >
                Confirm upload
              </Button>
            </>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

/* Reusable validation section card */
function ValidationSection({
  title,
  valid,
  subtitle,
  children,
}: {
  title: string;
  valid: boolean;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-[8px] border p-3 transition-colors",
        valid ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {valid ? (
            <Icon icon={icons.checkCircle} size={16} className="text-success" />
          ) : (
            <Icon icon={icons.x} size={16} className="text-destructive" />
          )}
          <span className={cn("text-sm font-medium", valid ? "text-success" : "text-destructive")}>{title}</span>
        </div>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
