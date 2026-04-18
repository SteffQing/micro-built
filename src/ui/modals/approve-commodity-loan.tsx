"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { getUserActiveLoan } from "@/lib/queries/admin/customer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { LoanIcons } from "@/components/svg/loan";
import { getConfig } from "@/lib/queries/config";
import { getTotalPayment } from "@/config/logic";

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
  managementFeeRate: z
    .number()
    .int("Management fee rate must be a whole number")
    .min(1, "Management fee rate must be at least 1%")
    .max(100, "Management fee rate cannot exceed 100%"),
  interestRate: z.number().min(0.1, "Interest rate must be at least 0.1%").max(100, "Interest rate cannot exceed 100%"),
});

export type CommodityLoanApprovalData = z.infer<typeof commodityLoanApprovalSchema>;

interface CommodityLoanApprovalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CommodityLoanApprovalData) => Promise<void>;
  isSubmitting?: boolean;
  assetName: string;
  borrowerId: string;
  closeMain: () => void;
}

export default function CommodityLoanApprovalModal({
  isOpen,
  onOpenChange,
  onSubmit,
  isSubmitting,
  assetName,
  borrowerId,
  closeMain,
}: CommodityLoanApprovalModalProps) {
  const { data: config } = useQuery(getConfig);

  const [showSuccess, setShowSuccess] = useState(false);
  const hasEdit = useRef(false);
  const [formData, setFormData] = useState<CommodityLoanApprovalData>({
    publicDetails: "",
    privateDetails: "",
    amount: 0,
    tenure: 6,
    managementFeeRate: 5,
    interestRate: 6,
  });

  useEffect(() => {
    if (config && !hasEdit.current) {
      setFormData((prev) => ({
        ...prev,
        managementFeeRate: config.data?.managementFeeRate || 5,
        interestRate: config.data?.interestRate || 6,
      }));
    }
  }, [config, hasEdit]);

  const { data, isLoading } = useQuery(getUserActiveLoan(borrowerId));

  const [errors, setErrors] = useState<Partial<Record<keyof CommodityLoanApprovalData, string>>>({});

  const validateForm = (): boolean => {
    try {
      commodityLoanApprovalSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof CommodityLoanApprovalData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const field = err.path[0] as keyof CommodityLoanApprovalData;
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

    const managementFeeAmount = (formData.amount * formData.managementFeeRate) / 100;
    const netAmount = formData.amount + managementFeeAmount;

    try {
      await onSubmit({ ...formData, amount: netAmount });
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
      managementFeeRate: 5,
      interestRate: 6,
    });
    setErrors({});
    onOpenChange(false);
  };

  const updateFormData = (field: keyof CommodityLoanApprovalData, value: string | number) => {
    hasEdit.current = true;
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleNumberInput = (field: keyof CommodityLoanApprovalData, value: string) => {
    const numValue = value === "" ? 0 : Number.parseFloat(value);
    if (!Number.isNaN(numValue)) {
      updateFormData(field, numValue);
    }
  };

  const managementFeeAmount = (formData.amount * formData.managementFeeRate) / 100;
  const netAmount = formData.amount + managementFeeAmount;
  const totalPayment = getTotalPayment(netAmount, formData.interestRate, formData.tenure);
  const interestAmount = totalPayment - netAmount;
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{showSuccess ? "Loan Approved Successfully" : `Approve ${assetName} Loan Purchase`}</DialogTitle>
        </DialogHeader>

        {showSuccess ? (
          <>
            <Separator className="bg-border" />
            <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
              <div className="flex flex-col gap-3 items-center justify-center py-8">
                <div className="flex items-center justify-center">
                  <LoanIcons.successful_application />
                </div>
                <h2 className="font-semibold text-xl text-center">Commodity Loan Approved Successfully</h2>
                <p className="text-muted-foreground font-normal text-sm text-center">
                  The {assetName} loan has been approved and the customer will be notified.
                </p>
              </div>
            </section>
            <DialogFooter>
              <Button
                className="w-full rounded-[8px] p-2.5 text-white font-medium text-sm btn-gradient"
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

            <ScrollArea className="max-h-[70vh]">
              <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
                <div className="grid gap-2">
                  <Label htmlFor="amount" className="text-muted-foreground text-sm font-normal">
                    Loan Amount (₦) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter loan amount in Naira"
                    value={formData.amount || ""}
                    onChange={(e) => handleNumberInput("amount", e.target.value)}
                    disabled={isSubmitting}
                    className={errors.amount ? "border-red-500" : ""}
                    min="1"
                    step="1000"
                  />
                  {errors.amount && <span className="text-sm text-red-500">{errors.amount}</span>}
                  {formData.amount > 0 && (
                    <span className="text-muted-foreground text-xs font-normal">
                      Amount: {formatCurrency(formData.amount)}
                    </span>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tenure" className="text-muted-foreground text-sm font-normal">
                    Loan Tenure (Months) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tenure"
                    type="number"
                    placeholder="Enter loan tenure in months"
                    value={formData.tenure || ""}
                    onChange={(e) => handleNumberInput("tenure", e.target.value)}
                    disabled={isSubmitting}
                    className={errors.tenure ? "border-red-500" : ""}
                    min="1"
                    max="60"
                    step="1"
                  />
                  {errors.tenure && <span className="text-sm text-red-500">{errors.tenure}</span>}
                  {formData.tenure > 0 && (
                    <span className="text-muted-foreground text-xs font-normal">
                      Duration: {formData.tenure} month
                      {formData.tenure !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="managementFeeRate" className="text-muted-foreground text-sm font-normal">
                    Management Fee Rate (%) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="managementFeeRate"
                    type="number"
                    placeholder="Enter management fee rate percentage"
                    value={formData.managementFeeRate || ""}
                    onChange={(e) => handleNumberInput("managementFeeRate", e.target.value)}
                    disabled={isSubmitting}
                    className={errors.managementFeeRate ? "border-red-500" : ""}
                    min="1"
                    max="100"
                    step="1"
                  />
                  {errors.managementFeeRate && <span className="text-sm text-red-500">{errors.managementFeeRate}</span>}
                  {formData.managementFeeRate > 0 && formData.amount > 0 && (
                    <span className="text-muted-foreground text-xs font-normal">
                      Management Fee: {formatCurrency(managementFeeAmount)}
                    </span>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="interestRate" className="text-muted-foreground text-sm font-normal">
                    Interest Rate (%) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="interestRate"
                    type="number"
                    placeholder="Enter interest rate percentage"
                    value={formData.interestRate || ""}
                    onChange={(e) => handleNumberInput("interestRate", e.target.value)}
                    disabled={isSubmitting}
                    className={errors.interestRate ? "border-red-500" : ""}
                    min="0.1"
                    max="100"
                    step="0.1"
                  />
                  {errors.interestRate && <span className="text-sm text-red-500">{errors.interestRate}</span>}
                  {formData.interestRate > 0 && formData.amount > 0 && (
                    <span className="text-muted-foreground text-xs font-normal">
                      Interest Amount: {formatCurrency(interestAmount)}
                    </span>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="public-details" className="text-muted-foreground text-sm font-normal">
                    Public Details <span className="text-red-500">*</span>
                    <span className="text-sm text-muted-foreground ml-2">(Visible to the customer)</span>
                  </Label>
                  <Textarea
                    id="public-details"
                    placeholder="e.g., Loan for purchase of farming equipment"
                    value={formData.publicDetails}
                    onChange={(e) => updateFormData("publicDetails", e.target.value)}
                    rows={3}
                    disabled={isSubmitting}
                    className={errors.publicDetails ? "border-red-500" : ""}
                    maxLength={1000}
                  />
                  {errors.publicDetails && <span className="text-sm text-red-500">{errors.publicDetails}</span>}
                  <span className="text-xs text-muted-foreground">{formData.publicDetails.length}/1000 characters</span>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="private-details" className="text-muted-foreground text-sm font-normal">
                    Private Details <span className="text-red-500">*</span>
                    <span className="text-sm text-muted-foreground ml-2">(Internal use only)</span>
                  </Label>
                  <Textarea
                    id="private-details"
                    placeholder="e.g., Requested to aid maize cultivation in 2025 Q1 season"
                    value={formData.privateDetails}
                    onChange={(e) => updateFormData("privateDetails", e.target.value)}
                    rows={3}
                    disabled={isSubmitting}
                    className={errors.privateDetails ? "border-red-500" : ""}
                    maxLength={1000}
                  />
                  {errors.privateDetails && <span className="text-sm text-red-500">{errors.privateDetails}</span>}
                  <span className="text-xs text-muted-foreground">
                    {formData.privateDetails.length}/1000 characters
                  </span>
                </div>

                {formData.amount > 0 && formData.managementFeeRate > 0 && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h4 className="font-semibold mb-2">Loan Summary</h4>
                    <div className="grid gap-1 text-sm">
                      <div className="flex justify-between">
                        <span>Loan Amount:</span>
                        <span className="font-medium">{formatCurrency(formData.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Management Fee ({formData.managementFeeRate}%):</span>
                        <span className="font-medium">{formatCurrency(managementFeeAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Interest ({formData.interestRate}%):</span>
                        <span className="font-medium">{formatCurrency(interestAmount)}</span>
                      </div>
                      <div className="flex flex-col gap-1 border-t pt-2 mt-1">
                        <div className="flex justify-between">
                          <span className="font-semibold">Net Charge to Customer:</span>
                          <span className="font-semibold">{formatCurrency(netAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span />
                          <span className="font-semibold text-xs">+ {formatCurrency(interestAmount)} Interest</span>
                        </div>
                        {data?.data && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Take note that this customer already has an existing Loan with a remaining tenure of{" "}
                            <strong>{data.data?.tenureLeft} months</strong>.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </ScrollArea>

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
                className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
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
