"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { getUserActiveLoan } from "@/lib/queries/admin/customer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumericalInput } from "@/components/ui/numerical-input";
import { z } from "zod";
import { toast } from "sonner";
import { LoanIcons } from "@/components/svg/loan";

const commodityLoanApprovalSchema = z.object({
  publicDetails: z
    .string()
    .min(1, "Public details are required")
    .max(1000, "Public details must be less than 1000 characters"),
  privateDetails: z
    .string()
    .min(1, "Private details are required")
    .max(1000, "Private details must be less than 1000 characters"),
  amount: z.number().min(1, "Amount must be greater than 0").max(100000000, "Amount cannot exceed ₦100,000,000"),
  tenure: z
    .number()
    .int("Tenure must be a whole number")
    .min(1, "Tenure must be at least 1 month")
    .max(60, "Tenure cannot exceed 60 months"),
  monthsDelta: z
    .number()
    .int("Months delta must be a whole number")
    .min(-60, "Months delta cannot reduce tenure by more than 60 months")
    .max(60, "Months delta cannot exceed 60 months")
    .optional(),
});

type FormState = z.infer<typeof commodityLoanApprovalSchema>;
/** What is sent: a top-up has no tenure, a new asset loan no adjustment. */
export type CommodityLoanApprovalData = Omit<FormState, "tenure"> & { tenure?: number };

interface CommodityLoanApprovalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CommodityLoanApprovalData) => Promise<void>;
  isSubmitting?: boolean;
  assetName: string;
  borrowerId: string;
  closeMain: () => void;
  /** TOPUP: an asset added to the running loan. It keeps the loan's tenure (only an optional adjustment). */
  kind: "NEW_LOAN" | "TOPUP";
}

export default function CommodityLoanApprovalModal({
  isOpen,
  onOpenChange,
  onSubmit,
  isSubmitting,
  assetName,
  borrowerId,
  closeMain,
  kind,
}: CommodityLoanApprovalModalProps) {
  const isTopup = kind === "TOPUP";
  const [showSuccess, setShowSuccess] = useState(false);
  const hasEdit = useRef(false);
  const [formData, setFormData] = useState<FormState>({
    publicDetails: "",
    privateDetails: "",
    amount: 0,
    tenure: 6,
    monthsDelta: undefined,
  });

  const { data, isLoading } = useQuery(getUserActiveLoan(borrowerId));

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const validateForm = (): boolean => {
    try {
      // A top-up takes no tenure (the API refuses one); a new asset loan takes no adjustment.
      (isTopup
        ? commodityLoanApprovalSchema.omit({ tenure: true })
        : commodityLoanApprovalSchema.omit({ monthsDelta: true })
      ).parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof FormState, string>> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const field = err.path[0] as keyof FormState;
            newErrors[field] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Validation Error", {
        description: "Please fix the errors in the form before submitting.",
      });
      return;
    }

    try {
      const { tenure, monthsDelta, ...rest } = formData;
      await onSubmit(isTopup ? { ...rest, monthsDelta } : { ...rest, tenure });
      setShowSuccess(true);
    } catch (error) {
      toast.error("An error occurred while approving the loan.");
      console.error("Failed to approve loan:", error);
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    setFormData({
      publicDetails: "",
      privateDetails: "",
      amount: 0,
      tenure: 6,
      monthsDelta: undefined,
    });
    setErrors({});
    onOpenChange(false);
  };

  const updateFormData = (field: keyof FormState, value: string | number | undefined) => {
    hasEdit.current = true;
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{showSuccess ? "Loan Approved Successfully" : isTopup ? `Approve ${assetName} Top-up` : `Approve ${assetName} Loan Purchase`}</DialogTitle>
        </DialogHeader>

        {showSuccess ? (
          <>
            <Separator className="bg-border" />
            <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
              <div className="flex flex-col gap-3 items-center justify-center py-8">
                <div className="flex items-center justify-center">
                  <LoanIcons.successful_application />
                </div>
                <h2 className="font-semibold text-xl text-center">
                  {isTopup ? "Asset Top-up Approved Successfully" : "Commodity Loan Approved Successfully"}
                </h2>
                <p className="text-muted-foreground font-normal text-sm text-center">
                  {isTopup
                    ? `The ${assetName} top-up has been approved; disburse it from Top-ups. The customer will be notified.`
                    : `The ${assetName} loan has been approved and the customer will be notified.`}
                </p>
              </div>
            </section>
            <DialogFooter>
              <Button
                className="w-full rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm btn-gradient"
                onClick={() => {
                  closeMain();
                  handleClose();
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <Separator className="bg-border" />

            <div className="min-w-0">
              <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
                <div className="grid gap-2">
                  <Label htmlFor="amount" className="text-muted-foreground text-sm font-normal">
                    {isTopup ? "Top-up Amount" : "Loan Amount"} (₦) <span className="text-destructive">*</span>
                    <span className="ml-1 text-xs text-muted-foreground">(the asset&apos;s price)</span>
                  </Label>
                  <NumericalInput
                    id="amount"
                    value={formData.amount}
                    onValueChange={(value) => updateFormData("amount", value)}
                    emptyOnZero
                    maxDecimals={2}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.amount)}
                    className={errors.amount ? "border-destructive" : ""}
                    min="1"
                    step="1000"
                  />
                  {errors.amount && <span className="text-sm text-destructive">{errors.amount}</span>}
                  {formData.amount > 0 && (
                    <span className="text-muted-foreground text-xs font-normal">
                      Amount: {formatCurrency(formData.amount)}
                    </span>
                  )}
                </div>

                {!isTopup && (
                  <div className="grid gap-2">
                    <Label htmlFor="tenure" className="text-muted-foreground text-sm font-normal">
                      Loan Tenure (Months) <span className="text-destructive">*</span>
                    </Label>
                    <NumericalInput
                      id="tenure"
                      value={formData.tenure}
                      onValueChange={(value) => updateFormData("tenure", value)}
                      emptyOnZero
                      maxDecimals={0}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(errors.tenure)}
                      className={errors.tenure ? "border-destructive" : ""}
                      min="1"
                      max="60"
                      step="1"
                    />
                    {errors.tenure && <span className="text-sm text-destructive">{errors.tenure}</span>}
                    {formData.tenure > 0 && (
                      <span className="text-muted-foreground text-xs font-normal">
                        Duration: {formData.tenure} month
                        {formData.tenure !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}

                {isTopup && (
                  <div className="grid gap-2">
                    <Label htmlFor="monthsDelta" className="text-muted-foreground text-sm font-normal">
                      Tenure Adjustment (Months)
                      <span className="text-muted-foreground font-normal text-xs ml-2">(Optional: positive extends, negative reduces)</span>
                    </Label>
                    <NumericalInput
                      id="monthsDelta"
                      value={formData.monthsDelta ?? 0}
                      onValueChange={(value) => updateFormData("monthsDelta", value || undefined)}
                      emptyOnZero
                      maxDecimals={0}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(errors.monthsDelta)}
                      className={errors.monthsDelta ? "border-destructive" : ""}
                      min="-60"
                      max="60"
                      step="1"
                    />
                    {errors.monthsDelta && <span className="text-sm text-destructive">{errors.monthsDelta}</span>}
                    {formData.monthsDelta != null && formData.monthsDelta !== 0 && (
                      <span className="text-muted-foreground text-xs font-normal">
                        Adjustment: {formData.monthsDelta > 0 ? "+" : ""}{formData.monthsDelta} month
                        {Math.abs(formData.monthsDelta) !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="public-details" className="text-muted-foreground text-sm font-normal">
                    Public Details <span className="text-destructive">*</span>
                    <span className="text-sm text-muted-foreground ml-2">(Visible to the customer)</span>
                  </Label>
                  <Textarea
                    id="public-details"
                    placeholder="e.g., Loan for purchase of farming equipment"
                    value={formData.publicDetails}
                    onChange={(e) => updateFormData("publicDetails", e.target.value)}
                    rows={3}
                    disabled={isSubmitting}
                    className={errors.publicDetails ? "border-destructive" : ""}
                    maxLength={1000}
                  />
                  {errors.publicDetails && <span className="text-sm text-destructive">{errors.publicDetails}</span>}
                  <span className="text-xs text-muted-foreground">{formData.publicDetails.length}/1000 characters</span>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="private-details" className="text-muted-foreground text-sm font-normal">
                    Private Details <span className="text-destructive">*</span>
                    <span className="text-sm text-muted-foreground ml-2">(Internal use only)</span>
                  </Label>
                  <Textarea
                    id="private-details"
                    placeholder="e.g., Requested to aid maize cultivation in 2025 Q1 season"
                    value={formData.privateDetails}
                    onChange={(e) => updateFormData("privateDetails", e.target.value)}
                    rows={3}
                    disabled={isSubmitting}
                    className={errors.privateDetails ? "border-destructive" : ""}
                    maxLength={1000}
                  />
                  {errors.privateDetails && <span className="text-sm text-destructive">{errors.privateDetails}</span>}
                  <span className="text-xs text-muted-foreground">
                    {formData.privateDetails.length}/1000 characters
                  </span>
                </div>

                {formData.amount > 0 && (
                  <div className="border rounded-lg p-4 bg-muted">
                    <h4 className="font-semibold mb-2">{isTopup ? "Top-up Summary" : "Loan Summary"}</h4>
                    <div className="grid gap-1 text-sm">
                      <div className="flex justify-between">
                        <span>{isTopup ? "Top-up Amount:" : "Loan Amount:"}</span>
                        <span className="font-medium">{formatCurrency(formData.amount)}</span>
                      </div>
                      {!isTopup && (
                        <div className="flex justify-between">
                          <span>Tenure:</span>
                          <span className="font-medium">{formData.tenure} month{formData.tenure !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      {formData.monthsDelta != null && formData.monthsDelta !== 0 && (
                        <div className="flex justify-between">
                          <span>Tenure Adjustment:</span>
                          <span className="font-medium">{formData.monthsDelta > 0 ? "+" : ""}{formData.monthsDelta} month{Math.abs(formData.monthsDelta) !== 1 ? "s" : ""}</span>
                        </div>
                      )}
                      {data?.data && (
                        <div className="flex flex-col gap-1 border-t pt-2 mt-1">
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {isTopup ? "This is added to the running loan, which has" : "Take note that this customer already has an existing Loan with"}{" "}
                            <strong>{data.data?.remainingMonths} months</strong> left
                            {isTopup && formData.monthsDelta ? ` (${data.data.remainingMonths + formData.monthsDelta} after the adjustment)` : ""}.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
              >
                Cancel
              </Button>
              <Button
                className="rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm flex-1 btn-gradient"
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={isLoading || isSubmitting}
              >
                Approve Loan
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
