"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NumericalInput } from "@/components/ui/numerical-input";
import { Icon, icons } from "@/components/icon";
import { formatCurrency } from "@/lib/utils";
import { liquidationPreview } from "@/lib/queries/user/liquidation";
import { requestLiquidation } from "@/lib/mutations/user/liquidation";
import { DetailRowsSkeleton } from "@/components/page-skeleton";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function getFilePreview(file: File): { type: "image" | "pdf"; url: string } | null {
  if (file.type.startsWith("image/")) {
    return { type: "image", url: URL.createObjectURL(file) };
  }
  if (file.type === "application/pdf") {
    return { type: "pdf", url: "" };
  }
  return null;
}

type ProofValidation = {
  valid: boolean;
  error: string | null;
};

function validateProof(file: File | null): ProofValidation {
  if (!file) return { valid: false, error: "Proof is required" };
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { valid: false, error: "Only PDF, JPG, and PNG files are accepted" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File must be 5MB or less" };
  }
  return { valid: true, error: null };
}

type Props = {
  trigger?: ReactNode;
};

export function CustomerLiquidationSheet({ trigger }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 4 = success
  const [amount, setAmount] = useState<number>(0);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<{
    type: "image" | "pdf";
    url: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setAmount(0);
      setProofFile(null);
      setProofError(null);
      if (proofPreview?.type === "image" && proofPreview.url) {
        URL.revokeObjectURL(proofPreview.url);
      }
      setProofPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isOpen]);

  const { data: previewData, isLoading: previewLoading } = useQuery({
    ...liquidationPreview,
    enabled: isOpen,
  });

  const preview = previewData?.data;
  const outstanding = preview?.outstanding ?? 0;

  const mutation = useMutation(requestLiquidation);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    const validation = validateProof(file);
    setProofFile(file);
    setProofError(validation.error);
    // Clean up previous preview
    if (proofPreview?.type === "image" && proofPreview.url) {
      URL.revokeObjectURL(proofPreview.url);
    }
    if (file && validation.valid) {
      setProofPreview(getFilePreview(file));
    } else {
      setProofPreview(null);
    }
  }

  function handlePayEverything() {
    setAmount(outstanding);
  }

  function canGoToStep2(): boolean {
    return amount > 0 && amount <= outstanding;
  }

  function canGoToStep3(): boolean {
    return canGoToStep2() && proofFile !== null && proofError === null;
  }

  async function handleSubmit() {
    if (!proofFile) return;
    await mutation.mutateAsync(
      { amount, proof: proofFile },
      {
        onSuccess: () => {
          setStep(4);
        },
      },
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            Liquidate Loan
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Liquidate Loan</SheetTitle>
          <SheetDescription>
            Submit a liquidation request for your active loan
          </SheetDescription>
        </SheetHeader>

        <Separator />

        {/* Step 1: Preview */}
        {step === 1 && (
          <div className="flex flex-col gap-4 p-4">
            {previewLoading ? (
              <DetailRowsSkeleton rows={5} className="rounded-lg bg-muted p-4" />
            ) : preview ? (
              <>
                <div className="bg-muted rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Liquidation Preview
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Outstanding</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(preview.outstanding)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Penalty Outstanding</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(preview.penaltyOutstanding)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Interest Outstanding</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(preview.interestOutstanding)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Principal Outstanding</p>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(preview.principalOutstanding)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Remaining Months</p>
                      <p className="font-semibold text-foreground">
                        {preview.remainingMonths}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Payment</p>
                      <p className="font-semibold text-foreground">
                        {preview.monthly ? formatCurrency(preview.monthly) : "—"}
                      </p>
                    </div>
                    {preview.endPeriod && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">End Period</p>
                        <p className="font-semibold text-foreground">
                          {preview.endPeriod}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Liquidation Amount
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePayEverything}
                      className="text-xs h-auto py-1 px-2"
                    >
                      Pay everything
                    </Button>
                  </div>
                  <NumericalInput
                    step="0.01"
                    min="0"
                    max={outstanding}
                    className="text-lg font-medium"
                    aria-label="Liquidation amount"
                    value={amount}
                    onValueChange={setAmount}
                    emptyOnZero
                    maxDecimals={2}
                  />
                  {amount > outstanding && (
                    <p className="text-xs text-destructive">
                      Amount cannot exceed outstanding balance
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No active loan found for liquidation.
              </div>
            )}
          </div>
        )}

        {/* Step 2: Proof Upload */}
        {step === 2 && (
          <div className="flex flex-col gap-4 p-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(amount)}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Upload Proof</label>
              <p id="proof-hint" className="text-xs text-muted-foreground">
                PDF, JPG, or PNG — max 5MB
              </p>
              <button
                type="button"
                className="w-full cursor-pointer rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => fileInputRef.current?.click()}
                aria-describedby="proof-hint"
              >
                <Icon
                  icon={icons.upload}
                  size={32}
                  className="mx-auto text-muted-foreground mb-2"
                />
                <span className="block text-sm text-muted-foreground">
                  Click to upload proof of payment
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
                tabIndex={-1}
                aria-hidden
              />

              {proofError && (
                <p className="text-xs text-destructive">{proofError}</p>
              )}

              {proofPreview && proofFile && (
                <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
                  {proofPreview.type === "image" ? (
                    <img
                      src={proofPreview.url}
                      alt="Proof preview"
                      className="w-16 h-16 object-cover rounded-md border border-border"
                    />
                  ) : (
                    <div className="w-16 h-16 flex items-center justify-center bg-background rounded-md border border-border">
                      <Icon
                        icon={icons.file}
                        size={24}
                        className="text-muted-foreground"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {proofFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(proofFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove proof file"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProofFile(null);
                      setProofError("Proof is required");
                      if (proofPreview?.type === "image" && proofPreview.url) {
                        URL.revokeObjectURL(proofPreview.url);
                      }
                      setProofPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <Icon icon={icons.x} size={16} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="flex flex-col gap-4 p-4">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Confirm Liquidation Request
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(amount)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Proof</span>
                  <span className="font-medium text-foreground truncate min-w-0 max-w-[60%]">
                    {proofFile?.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-destructive/5 rounded-lg p-3">
              <Icon
                icon={icons.alertTriangle}
                size={16}
                className="text-destructive mt-0.5 shrink-0"
              />
              <p className="text-xs text-muted-foreground">
                This request will be reviewed by an admin. You will be notified
                once a decision is made.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="flex flex-col items-center justify-center gap-4 p-4 py-12">
            <div className="rounded-full bg-success/10 p-4">
              <Icon
                icon={icons.checkCircle}
                size={40}
                className="text-success"
              />
            </div>
            <h3 className="text-lg font-semibold text-center">
              Liquidation Request Submitted
            </h3>
            <p className="text-sm text-muted-foreground text-center">
              Your request for{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(amount)}
              </span>{" "}
              has been submitted and is pending review.
            </p>
          </div>
        )}

        <SheetFooter>
          {step === 1 && (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!canGoToStep2()}
                className="btn-gradient flex-1"
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canGoToStep3()}
                className="btn-gradient flex-1"
              >
                Continue
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={mutation.isPending}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                loading={mutation.isPending}
                className="btn-gradient flex-1"
              >
                Submit Request
              </Button>
            </div>
          )}

          {step === 4 && (
            <Button
              onClick={() => setIsOpen(false)}
              className="btn-gradient w-full"
            >
              Done
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
