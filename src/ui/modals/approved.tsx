"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { userPaymentMethod } from "@/lib/queries/user";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { z } from "zod";

interface ApprovedLoanModalProps {
  loan: CashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDisbursement: () => void;
  loading: boolean;
}

export function ApprovedLoanModal({
  loan,
  isOpen,
  onOpenChange,
  onConfirmDisbursement,
  loading,
}: ApprovedLoanModalProps) {
  const [disbursementConfirmed, setDisbursementConfirmed] = useState(false);
  const { data, isLoading } = useQuery(userPaymentMethod);

  const disburseAmount = loan.amount - loan.amount * (loan.managementFeeRate / 100);
  const expectedInterestAmount = loan.amount * (loan.interestRate / 100);
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + loan.loanTenure);

  const handleConfirmDisbursementClick = () => {
    if (disbursementConfirmed) {
      onConfirmDisbursement();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Loan Disbursement</DialogTitle>
          {/* <DialogDescription>Confirm the disbursement details for the loan.</DialogDescription> */}
        </DialogHeader>
        <Separator className="bg-[#F0F0F0]" />

        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          {isLoading ? (
            <div className="grid gap-4 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonDetail key={index} />
              ))}
            </div>
          ) : !data?.data ? (
            <p>Payment method not found!</p>
          ) : (
            <div className="grid gap-4 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
              <Detail title="Bank Name" content={data.data.bankName} />
              <Detail title="Account Name" content={data.data.accountName} />
              <Detail title="Account Number" content={data.data.accountNumber} />
            </div>
          )}
          <div className="grid gap-4 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
            <Detail title="Amount to Disburse" content={formatCurrency(disburseAmount)} />
            <Detail title="Expected Interest Amount" content={formatCurrency(expectedInterestAmount)} />
            <Detail title="Total Expected Amount" content={formatCurrency(loan.amountRepayable)} />
            <Detail title="Due Date" content={formatDate(dueDate, "PPP")} />
          </div>
          <div className="flex items-start space-x-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <Checkbox
              id="disbursement-confirm"
              checked={disbursementConfirmed}
              onCheckedChange={(checked) => setDisbursementConfirmed(!!checked)}
              className="mt-0.5 border-red-400 data-[state=checked]:bg-red-600 data-[state=checked]:text-white"
              disabled={!data?.data && loan.category !== "ASSET_PURCHASE"}
            />
            <label
              htmlFor="disbursement-confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I can confirm that the requested funds for this particular loan application has been disbursed to the
              account details provided by the customer.
            </label>
          </div>
        </section>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
            onClick={handleConfirmDisbursementClick}
            disabled={!disbursementConfirmed}
            loading={loading}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  title: string;
  content: string;
}

function Detail({ title, content }: Props) {
  return (
    <div className="flex justify-between items-center gap-4">
      <p className="text-[#999999] text-sm font-normal">{title}</p>
      <p className="text-[#333333] text-sm font-medium">{content}</p>
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div className="flex justify-between items-center gap-4 animate-pulse">
      <div className="h-4 bg-gray-300 rounded w-1/3" />
      <div className="h-4 bg-gray-300 rounded w-1/2" />
    </div>
  );
}

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
});

export type CommodityLoanApprovalData = z.infer<typeof commodityLoanApprovalSchema>;

interface CommodityLoanApprovalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CommodityLoanApprovalData) => Promise<void>;
  isSubmitting?: boolean;
  assetName: string;
}

export function CommodityLoanApprovalModal({
  isOpen,
  onOpenChange,
  onSubmit,
  isSubmitting,
  assetName,
}: CommodityLoanApprovalModalProps) {
  const [formData, setFormData] = useState<CommodityLoanApprovalData>({
    publicDetails: "",
    privateDetails: "",
    amount: 0,
    tenure: 6,
    managementFeeRate: 5,
  });

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
      return;
    }

    await onSubmit(formData);
    setFormData({
      publicDetails: "",
      privateDetails: "",
      amount: 0,
      tenure: 6,
      managementFeeRate: 5,
    });
    setErrors({});
  };

  const updateFormData = (field: keyof CommodityLoanApprovalData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing/changing
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
  const netAmount = formData.amount - managementFeeAmount;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {assetName} Loan Purchase</DialogTitle>
        </DialogHeader>
        <Separator className="bg-[#F0F0F0]" />

        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          <div className="grid gap-2">
            <Label htmlFor="amount" className="text-[#999999] text-sm font-normal">
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
              <span className="text-[#999999] text-xs font-normal">Amount: {formatCurrency(formData.amount)}</span>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tenure" className="text-[#999999] text-sm font-normal">
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
              <span className="text-[#999999] text-xs font-normal">
                Duration: {formData.tenure} month{formData.tenure !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="managementFeeRate" className="text-[#999999] text-sm font-normal">
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
              <span className="text-[#999999] text-xs font-normal">
                Management Fee: {formatCurrency(managementFeeAmount)}
              </span>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="public-details" className="text-[#999999] text-sm font-normal">
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
            <Label htmlFor="private-details" className="text-[#999999] text-sm font-normal">
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
            <span className="text-xs text-muted-foreground">{formData.privateDetails.length}/1000 characters</span>
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
                  <span>Tenure:</span>
                  <span className="font-medium">
                    {formData.tenure} month{formData.tenure !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="font-semibold">Net Amount to Customer:</span>
                  <span className="font-semibold">{formatCurrency(netAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
            onClick={handleSubmit}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            Approve Loan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
