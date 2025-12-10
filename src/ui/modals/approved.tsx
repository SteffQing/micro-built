"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
	customerPaymentMethod,
	getUserActiveLoan,
} from "@/lib/queries/admin/customer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calculateTotalExpectedPayment } from "@/config/value-helpers";
import { toast } from "sonner";
import { LoanIcons } from "@/components/svg/loan";

interface ApprovedLoanModalProps {
	loan: CashLoan;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirmDisbursement: () => void;
	loading: boolean;
}

const commodity = (asset: string) =>
	`I can confirm that the ${asset} has been shipped out/about to be shipped out.`;

export function ApprovedLoanModal({
	loan,
	isOpen,
	onOpenChange,
	onConfirmDisbursement,
	loading,
}: ApprovedLoanModalProps) {
	const [disbursementConfirmed, setDisbursementConfirmed] = useState(false);
	const { data, isLoading } = useQuery(customerPaymentMethod(loan.borrower.id));

	const expectedAmount = calculateTotalExpectedPayment(
		loan.amount,
		loan.interestRate,
		loan.tenure,
	);

	const disburseAmount =
		loan.amount - loan.amount * (loan.managementFeeRate / 100);
	const expectedInterestAmount = loan.amount * (loan.interestRate / 100);
	const dueDate = new Date();
	dueDate.setMonth(dueDate.getMonth() + loan.tenure);

	const handleConfirmDisbursementClick = () => {
		if (disbursementConfirmed) {
			onConfirmDisbursement();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Loan Disbursement</DialogTitle>
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
						<div className="flex flex-col gap-1">
							<h3 className="text-sm font-semibold ">Payment Information</h3>
							<div className="grid gap-2 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
								<Detail title="Bank Name" content={data.data.bankName} />
								<Detail title="Account Name" content={data.data.accountName} />
								<Detail
									title="Account Number"
									content={data.data.accountNumber}
								/>
							</div>
						</div>
					)}
					<div className="flex flex-col gap-1">
						<h3 className="text-sm font-semibold ">Loan Information</h3>
						<div className="grid gap-2 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
							<Detail
								title="Amount to Disburse"
								content={formatCurrency(disburseAmount)}
							/>
							<Detail
								title="Expected Interest Amount"
								content={formatCurrency(expectedInterestAmount)}
							/>
							<Detail
								title="Total Expected Amount"
								content={formatCurrency(expectedAmount)}
							/>
							<Detail title="Due Date" content={formatDate(dueDate, "PPP")} />
						</div>
					</div>
					<div className="flex items-start space-x-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
						<Checkbox
							id="disbursement-confirm"
							checked={disbursementConfirmed}
							onCheckedChange={(checked) => setDisbursementConfirmed(!!checked)}
							className="mt-0.5 border-red-400 data-[state=checked]:bg-red-600 data-[state=checked]:text-white"
							// disabled={!data?.data && loan.category !== "ASSET_PURCHASE"}
						/>
						<label
							htmlFor="disbursement-confirm"
							className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
							{loan.asset
								? commodity(loan.asset.name)
								: "I can confirm that the requested funds for this particular loan application has been disbursed to the account details provided by the customer."}
						</label>
					</div>
				</section>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
						className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm">
						Cancel
						{/* Should be reject */}
					</Button>
					<Button
						className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
						onClick={handleConfirmDisbursementClick}
						loading={loading}
						disabled={!disbursementConfirmed || loading}>
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
			<p className="text-muted-foreground text-sm font-normal">{title}</p>
			<p className=" text-sm font-medium">{content}</p>
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
	amount: z
		.number()
		.min(1, "Amount must be greater than 0")
		.max(100000000, "Amount cannot exceed ₦100,000,000"),
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
	interestRate: z
		.number()
		.min(0.1, "Interest rate must be at least 0.1%")
		.max(100, "Interest rate cannot exceed 100%"),
});

export type CommodityLoanApprovalData = z.infer<
	typeof commodityLoanApprovalSchema
>;

interface CommodityLoanApprovalModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: CommodityLoanApprovalData) => Promise<void>;
	isSubmitting?: boolean;
	assetName: string;
	borrowerId: string;
}

export function CommodityLoanApprovalModal({
	isOpen,
	onOpenChange,
	onSubmit,
	isSubmitting,
	assetName,
	borrowerId,
}: CommodityLoanApprovalModalProps) {
	const [showSuccess, setShowSuccess] = useState(false);
	const [formData, setFormData] = useState<CommodityLoanApprovalData>({
		publicDetails: "",
		privateDetails: "",
		amount: 0,
		tenure: 6,
		managementFeeRate: 5,
		interestRate: 6,
	});

	const { data, isLoading } = useQuery(getUserActiveLoan(borrowerId));

	const [errors, setErrors] = useState<
		Partial<Record<keyof CommodityLoanApprovalData, string>>
	>({});

	const validateForm = (): boolean => {
		try {
			commodityLoanApprovalSchema.parse(formData);
			setErrors({});
			return true;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const newErrors: Partial<
					Record<keyof CommodityLoanApprovalData, string>
				> = {};
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

		const managementFeeAmount =
			(formData.amount * formData.managementFeeRate) / 100;
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

	const updateFormData = (
		field: keyof CommodityLoanApprovalData,
		value: string | number,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear error when user starts typing/changing
		if (errors[field]) {
			setErrors((prev) => ({ ...prev, [field]: undefined }));
		}
	};

	const handleNumberInput = (
		field: keyof CommodityLoanApprovalData,
		value: string,
	) => {
		const numValue = value === "" ? 0 : Number.parseFloat(value);
		if (!Number.isNaN(numValue)) {
			updateFormData(field, numValue);
		}
	};

	const managementFeeAmount =
		(formData.amount * formData.managementFeeRate) / 100;
	const interestAmount = (formData.amount * formData.interestRate) / 100;
	const netAmount = formData.amount + managementFeeAmount;

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{showSuccess
							? "Loan Approved Successfully"
							: `Approve ${assetName} Loan Purchase`}
					</DialogTitle>
				</DialogHeader>

				{showSuccess ? (
					<>
						<Separator className="bg-[#F0F0F0]" />
						<section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
							<div className="flex flex-col gap-3 items-center justify-center py-8">
								<div className="flex items-center justify-center">
									<LoanIcons.successful_application />
								</div>
								<h2 className="font-semibold text-xl text-center">
									Commodity Loan Approved Successfully
								</h2>
								<p className="text-muted-foreground font-normal text-sm text-center">
									The {assetName} loan has been approved and the customer will
									be notified. You can now proceed to disburse the loan.
								</p>
							</div>
						</section>
						<DialogFooter>
							<Button
								className="w-full rounded-[8px] p-2.5 text-white font-medium text-sm btn-gradient"
								onClick={handleClose}>
								Close
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Approve {assetName} Loan Purchase</DialogTitle>
						</DialogHeader>
						<Separator className="bg-[#F0F0F0]" />

						<ScrollArea className="max-h-[70vh]">
							<section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
								<div className="grid gap-2">
									<Label
										htmlFor="amount"
										className="text-muted-foreground text-sm font-normal">
										Loan Amount (₦) <span className="text-red-500">*</span>
									</Label>
									<Input
										id="amount"
										type="number"
										placeholder="Enter loan amount in Naira"
										value={formData.amount || ""}
										onChange={(e) =>
											handleNumberInput("amount", e.target.value)
										}
										disabled={isSubmitting}
										className={errors.amount ? "border-red-500" : ""}
										min="1"
										step="1000"
									/>
									{errors.amount && (
										<span className="text-sm text-red-500">
											{errors.amount}
										</span>
									)}
									{formData.amount > 0 && (
										<span className="text-muted-foreground text-xs font-normal">
											Amount: {formatCurrency(formData.amount)}
										</span>
									)}
								</div>

								<div className="grid gap-2">
									<Label
										htmlFor="tenure"
										className="text-muted-foreground text-sm font-normal">
										Loan Tenure (Months) <span className="text-red-500">*</span>
									</Label>
									<Input
										id="tenure"
										type="number"
										placeholder="Enter loan tenure in months"
										value={formData.tenure || ""}
										onChange={(e) =>
											handleNumberInput("tenure", e.target.value)
										}
										disabled={isSubmitting}
										className={errors.tenure ? "border-red-500" : ""}
										min="1"
										max="60"
										step="1"
									/>
									{errors.tenure && (
										<span className="text-sm text-red-500">
											{errors.tenure}
										</span>
									)}
									{formData.tenure > 0 && (
										<span className="text-muted-foreground text-xs font-normal">
											Duration: {formData.tenure} month
											{formData.tenure !== 1 ? "s" : ""}
										</span>
									)}
								</div>

								<div className="grid gap-2">
									<Label
										htmlFor="managementFeeRate"
										className="text-muted-foreground text-sm font-normal">
										Management Fee Rate (%){" "}
										<span className="text-red-500">*</span>
									</Label>
									<Input
										id="managementFeeRate"
										type="number"
										placeholder="Enter management fee rate percentage"
										value={formData.managementFeeRate || ""}
										onChange={(e) =>
											handleNumberInput("managementFeeRate", e.target.value)
										}
										disabled={isSubmitting}
										className={errors.managementFeeRate ? "border-red-500" : ""}
										min="1"
										max="100"
										step="1"
									/>
									{errors.managementFeeRate && (
										<span className="text-sm text-red-500">
											{errors.managementFeeRate}
										</span>
									)}
									{formData.managementFeeRate > 0 && formData.amount > 0 && (
										<span className="text-muted-foreground text-xs font-normal">
											Management Fee: {formatCurrency(managementFeeAmount)}
										</span>
									)}
								</div>

								<div className="grid gap-2">
									<Label
										htmlFor="interestRate"
										className="text-muted-foreground text-sm font-normal">
										Interest Rate (%) <span className="text-red-500">*</span>
									</Label>
									<Input
										id="interestRate"
										type="number"
										placeholder="Enter interest rate percentage"
										value={formData.interestRate || ""}
										onChange={(e) =>
											handleNumberInput("interestRate", e.target.value)
										}
										disabled={isSubmitting}
										className={errors.interestRate ? "border-red-500" : ""}
										min="0.1"
										max="100"
										step="0.1"
									/>
									{errors.interestRate && (
										<span className="text-sm text-red-500">
											{errors.interestRate}
										</span>
									)}
									{formData.interestRate > 0 && formData.amount > 0 && (
										<span className="text-muted-foreground text-xs font-normal">
											Interest Amount:{" "}
											{formatCurrency(
												(formData.amount * formData.interestRate) / 100,
											)}
										</span>
									)}
								</div>

								<div className="grid gap-2">
									<Label
										htmlFor="public-details"
										className="text-muted-foreground text-sm font-normal">
										Public Details <span className="text-red-500">*</span>
										<span className="text-sm text-muted-foreground ml-2">
											(Visible to the customer)
										</span>
									</Label>
									<Textarea
										id="public-details"
										placeholder="e.g., Loan for purchase of farming equipment"
										value={formData.publicDetails}
										onChange={(e) =>
											updateFormData("publicDetails", e.target.value)
										}
										rows={3}
										disabled={isSubmitting}
										className={errors.publicDetails ? "border-red-500" : ""}
										maxLength={1000}
									/>
									{errors.publicDetails && (
										<span className="text-sm text-red-500">
											{errors.publicDetails}
										</span>
									)}
									<span className="text-xs text-muted-foreground">
										{formData.publicDetails.length}/1000 characters
									</span>
								</div>

								<div className="grid gap-2">
									<Label
										htmlFor="private-details"
										className="text-muted-foreground text-sm font-normal">
										Private Details <span className="text-red-500">*</span>
										<span className="text-sm text-muted-foreground ml-2">
											(Internal use only)
										</span>
									</Label>
									<Textarea
										id="private-details"
										placeholder="e.g., Requested to aid maize cultivation in 2025 Q1 season"
										value={formData.privateDetails}
										onChange={(e) =>
											updateFormData("privateDetails", e.target.value)
										}
										rows={3}
										disabled={isSubmitting}
										className={errors.privateDetails ? "border-red-500" : ""}
										maxLength={1000}
									/>
									{errors.privateDetails && (
										<span className="text-sm text-red-500">
											{errors.privateDetails}
										</span>
									)}
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
												<span className="font-medium">
													{formatCurrency(formData.amount)}
												</span>
											</div>
											<div className="flex justify-between">
												<span>
													Management Fee ({formData.managementFeeRate}%):
												</span>
												<span className="font-medium">
													{formatCurrency(managementFeeAmount)}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Interest ({formData.interestRate}%):</span>
												<span className="font-medium">
													{formatCurrency(interestAmount)}
												</span>
											</div>
											<div className="flex flex-col gap-1 border-t pt-2 mt-1">
												<div className="flex justify-between">
													<span className="font-semibold">
														Net Charge to Customer:
													</span>
													<span className="font-semibold">
														{formatCurrency(netAmount)}
													</span>
												</div>
												{data?.data && data.data.length > 0 && (
													<p className="text-xs text-muted-foreground leading-relaxed">
														{" "}
														Approving this loan will{" "}
														<strong>add to the existing loan tenure</strong>.
														<br />
														New loan tenure:{" "}
														<strong>
															{(data.data[0]?.tenure ?? 0) +
																(formData.tenure || 0)}{" "}
															months
														</strong>
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
								className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm">
								Cancel
							</Button>
							<Button
								className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
								onClick={handleSubmit}
								loading={isSubmitting}
								disabled={isLoading || isSubmitting}>
								Approve Loan
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
