import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  uploadRepayment,
  validateRepayment,
} from "@/lib/mutations/admin/repayments";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { useUserProvider } from "@/store/auth";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";

type DialogStep = "select" | "validating" | "results";

export default function UploadRepayment() {
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<DialogStep>("select");
  const [validationResult, setValidationResult] =
    useState<RepaymentValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { userRole } = useUserProvider();

  function reset() {
    setPeriod("");
    setSelectedFile(null);
    setStep("select");
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isXlsx =
      file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.name.endsWith(".xlsx");

    if (!isXlsx) {
      toast.error("Please select a valid .xlsx file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);
    // Reset validation when new file is selected
    setValidationResult(null);
    setStep("select");
  };

  const {
    mutateAsync: validateAsync,
    isPending: isValidating,
  } = useMutation(validateRepayment);

  const { mutateAsync: uploadAsync, isPending: isUploading } =
    useMutation(uploadRepayment);

  const handleValidate = async () => {
    if (!selectedFile) return;

    setStep("validating");
    try {
      const result = await validateAsync(selectedFile);
      setValidationResult(result.data ?? null);
      setStep("results");
    } catch {
      setStep("select");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const data = {
      file: selectedFile,
      period,
    };

    await uploadAsync(data);
    reset();
    setIsOpen(false);
  };

  const isFullyValid =
    validationResult?.headers.valid && validationResult?.rows?.valid;

  const dialogTitle =
    step === "select"
      ? "Upload Repayment File"
      : step === "validating"
        ? "Validating File…"
        : "Validation Results";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={userRole !== "SUPER_ADMIN"}>
          Upload Repayment
        </Button>
      </DialogTrigger>
      <DialogContent
        className={
          step === "results" ? "sm:max-w-[540px]" : "sm:max-w-[425px]"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "results" && (
              <button
                onClick={() => setStep("select")}
                className="rounded-md p-0.5 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        <Separator className="bg-border" />

        {/* ─── Step 1: File Selection ─── */}
        {(step === "select" || step === "validating") && (
          <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
            <p className="font-normal text-sm text-muted-foreground">
              Upload your repayment data file to automatically match payments to
              customer loans
            </p>

            <div className="flex gap-5 flex-col border border-border rounded-[8px] p-3">
              <Label
                className="text-foreground text-sm font-medium"
                htmlFor="repayment-upload-input"
              >
                File{" "}
                <span className="text-muted-foreground font-normal text-xs">XLSX</span>
              </Label>

              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="hidden"
                id="repayment-upload-input"
              />

              {selectedFile ? (
                <Button
                  className="max-h-12 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-2.5 rounded-[4px] gap-2 text-green-700 dark:text-green-400 text-xs font-normal disabled:opacity-100"
                  disabled
                >
                  <Icons.file className="mr-2 " />
                  <span className="truncate max-w-[20ch]">
                    {selectedFile.name}
                  </span>
                  <span className="text-foreground">{`(${(
                    selectedFile.size / 1024
                  ).toFixed(2)} KB)`}</span>
                  <Icons.good_check />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="max-h-12 bg-muted border border-border p-2.5 rounded-[8px] gap-1 text-muted-foreground text-xs font-normal"
                  disabled={isValidating}
                >
                  <Icons.upload className="mr-2" />
                  Upload File
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">Repayment Period</Label>
              <Input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="APRIL 2025"
                disabled={isValidating}
              />
            </div>

            <Separator className="bg-border" />
          </section>
        )}

        {/* ─── Step 2: Validation Results ─── */}
        {step === "results" && validationResult && (
          <section className="grid gap-4 p-4 sm:p-5">
            {/* File info compact bar */}
            <div className="flex items-center gap-2 bg-muted border border-border rounded-[8px] p-2.5">
              <FileSpreadsheet className="h-4 w-4 text-foreground shrink-0" />
              <span className="text-xs text-foreground truncate">
                {selectedFile?.name}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                ({((selectedFile?.size ?? 0) / 1024).toFixed(1)} KB)
              </span>
            </div>

            {/* Header validation */}
            <ValidationSection
              title="Header Validation"
              valid={validationResult.headers.valid}
            >
              {validationResult.headers.valid ? (
                <p className="text-xs text-foreground">
                  All required headers are present.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-600">
                    Missing required headers:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {validationResult.headers.missing.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2 py-1 rounded-md border border-red-200 font-mono"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </ValidationSection>

            {/* Row validation */}
            {validationResult.rows ? (
              <ValidationSection
                title="Row Validation"
                valid={validationResult.rows.valid}
                subtitle={`${validationResult.rows.totalRows} rows parsed`}
              >
                {validationResult.rows.valid ? (
                  <p className="text-xs text-foreground">
                    All {validationResult.rows.totalRows} rows are valid.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-700">
                      <span className="font-semibold">
                        {validationResult.rows.invalidRows.length}
                      </span>{" "}
                      of {validationResult.rows.totalRows} rows have issues
                    </p>

                    {/* Invalid rows table */}
                    <div className="max-h-[200px] overflow-y-auto rounded-md border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left py-2 px-3 font-medium text-foreground border-b border-border">
                              Row
                            </th>
                            <th className="text-left py-2 px-3 font-medium text-foreground border-b border-border">
                              Staff ID
                            </th>
                            <th className="text-left py-2 px-3 font-medium text-foreground border-b border-border">
                              Issues
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {validationResult.rows.invalidRows.map(
                            (row, index) => (
                              <tr
                                key={index}
                                className="border-b last:border-0 border-border hover:bg-muted transition-colors"
                              >
                                <td className="py-2 px-3 text-foreground font-mono tabular-nums">
                                  {row.row}
                                </td>
                                <td className="py-2 px-3 text-foreground font-mono">
                                  {row.staffId || "—"}
                                </td>
                                <td className="py-2 px-3">
                                  <ul className="space-y-0.5">
                                    {row.issues.map((issue, i) => (
                                      <li
                                        key={i}
                                        className="text-red-600 flex items-start gap-1"
                                      >
                                        <span className="text-red-400 mt-0.5 shrink-0">
                                          •
                                        </span>
                                        {issue}
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </ValidationSection>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-[8px] p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">
                  Row validation skipped — fix header issues first.
                </p>
              </div>
            )}

            {/* Summary status */}
            {isFullyValid && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-[8px] p-3">
                <ShieldCheck className="h-4 w-4 text-green-700 dark:text-green-400 shrink-0" />
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  File is valid and ready to upload for period{" "}
                  <span className="font-semibold">{period}</span>.
                </p>
              </div>
            )}

            <Separator className="bg-border" />
          </section>
        )}

        {/* ─── Footer ─── */}
        <DialogFooter>
          {step === "select" || step === "validating" ? (
            <>
              <Button
                variant="outline"
                onClick={reset}
                disabled={isValidating}
                className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
              >
                Cancel
              </Button>
              <Button
                className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
                onClick={handleValidate}
                loading={isValidating}
                disabled={!period || !selectedFile || isValidating}
              >
                <ShieldCheck className="h-4 w-4" />
                Validate
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  setValidationResult(null);
                  setStep("select");
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                disabled={isUploading}
                className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
              >
                Re-upload
              </Button>
              <Button
                className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
                onClick={handleUpload}
                loading={isUploading}
                disabled={!isFullyValid || isUploading}
              >
                Confirm Upload
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reusable validation section card ─── */
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
      className={`rounded-[8px] border p-3 space-y-2 transition-colors ${
        valid
          ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
          : "border-red-200 bg-red-50/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {valid ? (
            <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span
            className={`text-sm font-medium ${valid ? "text-green-700 dark:text-green-400" : "text-red-700"}`}
          >
            {title}
          </span>
        </div>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}
