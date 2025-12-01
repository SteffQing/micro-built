"use client";

import React from "react";
import { DatePicker, InputBox, SelectBox } from "./input-components";
import { useFormContext } from "react-hook-form";
import {
	Gender,
	LoanCategory,
	MaritalStatus,
	Relationship,
} from "@/config/enums";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { OnboardCustomerType } from "./schema";

export function CustomerDetail() {
	return (
		<>
			<InputBox
				label="Full Name"
				placeholder="Enter Customer's Name"
				name="user.name"
			/>
			<div className="flex gap-4">
				<InputBox
					label="Email Address"
					placeholder="Enter email address"
					name="user.email"
				/>
				<InputBox
					label="Phone Number"
					placeholder="Enter 11-digit phone number"
					name="user.contact"
					labelPos="right"
				/>
			</div>
		</>
	);
}

export function UserIdentity() {
	return (
		<>
			<DatePicker
				label="Date of Birth"
				name="identity.dateOfBirth"
				placeholder="YYYY-MM-DD"
			/>

			<div className="flex gap-4 w-full">
				<SelectBox
					label="Gender"
					name="identity.gender"
					options={Object.values(Gender).map((value) => ({
						label: value,
						value,
					}))}
				/>

				<SelectBox
					label="Marital Status"
					name="identity.maritalStatus"
					options={Object.values(MaritalStatus).map((value) => ({
						label: value,
						value,
					}))}
					labelPos="right"
				/>
			</div>

			<InputBox
				label="Residency Address"
				placeholder="Enter your address"
				name="identity.residencyAddress"
			/>

			<div className="flex gap-4">
				<InputBox
					label="State of Residency"
					placeholder="Enter state"
					name="identity.stateResidency"
				/>

				<InputBox
					label="Nearest Landmark"
					placeholder="Enter landmark or bus stop"
					name="identity.landmarkOrBusStop"
					labelPos="right"
				/>
			</div>
			<Separator className="bg-[#F0F0F0]" />

			<div className="flex gap-4">
				<InputBox
					label="Next of Kin Name"
					placeholder="Enter next of kin's name"
					name="identity.nextOfKinName"
				/>

				<InputBox
					label="Next of Kin Address"
					placeholder="Enter address"
					name="identity.nextOfKinAddress"
					labelPos="right"
				/>
			</div>

			<div className="flex gap-4">
				<InputBox
					label="Next of Kin Contact"
					placeholder="Enter phone number"
					name="identity.nextOfKinContact"
				/>
				<SelectBox
					label="Next of Kin Relationship"
					name="identity.nextOfKinRelationship"
					options={Object.values(Relationship).map((value) => ({
						label: value,
						value,
					}))}
					placeholder="Relationship"
					labelPos="right"
				/>
			</div>
		</>
	);
}

export function UserPayroll() {
	return (
		<>
			<InputBox
				label="External (IPPIS) ID"
				placeholder="Enter employee (IPPIS) ID"
				name="payroll.externalId"
			/>

			<div className="flex gap-4 w-full">
				<InputBox
					label="Grade (Optional)"
					placeholder="Enter grade"
					name="payroll.grade"
				/>
				<InputBox
					label="Step (Optional)"
					type="number"
					placeholder="Enter step"
					name="payroll.step"
					labelPos="right"
				/>
			</div>

			<InputBox
				label="Command"
				placeholder="Enter command"
				name="payroll.command"
			/>

			<InputBox
				label="Organization"
				placeholder="Enter organization (e.g., NPF)"
				name="payroll.organization"
			/>
		</>
	);
}

export function UserPaymentMethod() {
	return (
		<>
			<InputBox
				label="Bank Name"
				placeholder="Enter bank name"
				name="paymentMethod.bankName"
			/>

			<InputBox
				label="Account Number"
				placeholder="Enter 10-digit account number"
				name="paymentMethod.accountNumber"
			/>

			<InputBox
				label="Account Name"
				placeholder="Enter account name"
				name="paymentMethod.accountName"
			/>

			<InputBox
				label="BVN"
				placeholder="Enter 11-digit BVN"
				name="paymentMethod.bvn"
			/>
		</>
	);
}

function CommodityLoanRequest() {
	return (
		<div className="flex flex-col gap-4">
			<InputBox
				label="Asset Name"
				name="loan.commodityLoan.assetName"
				placeholder="Enter asset name"
			/>
			<p className="text-sm text-gray-500">
				After pushing this asset loan, please conduct market research to approve
				the commodity loan. This is where you will get values like management
				fee, public and private details to set for the loan.
			</p>
		</div>
	);
}

function CashLoanRequest() {
	return (
		<div className="flex flex-col gap-4">
			<InputBox
				label="Cash Loan Amount"
				name="loan.cashLoan.amount"
				type="number"
				placeholder="Enter amount"
			/>
			<InputBox
				label="Tenure (months)"
				name="loan.cashLoan.tenure"
				type="number"
				placeholder="Enter tenure"
			/>
			<p className="text-sm text-gray-500">
				This loan gets automatic approval for disbursement.
			</p>
		</div>
	);
}

// export function LoanRequestForm() {
//   const { setValue, watch } = useFormContext<OnboardCustomerType>();

//   const category = watch("loan.category");

//   function handleCategoryChange(newCategory: LoanCategory) {
//     setValue("loan.category", newCategory);

//     if (newCategory === LoanCategory.ASSET_PURCHASE) {
//       setValue("loan.cashLoan", undefined);
//     } else {
//       setValue("loan.commodityLoan", undefined);
//     }
//   }

//   return (
//     <>
//       <div className="flex flex-col gap-3 w-full">
//         <Label className="text-sm font-medium">Loan Type</Label>
//         <Select
//           value={category ?? ""}
//           onValueChange={(value) => handleCategoryChange(value as LoanCategory)}
//         >
//           <SelectTrigger className="w-full">
//             <SelectValue placeholder="Select Loan Type" />
//           </SelectTrigger>
//           <SelectContent>
//             {Object.values(LoanCategory).map((type) => (
//               <SelectItem value={type} key={type}>
//                 {type
//                   .toLowerCase()
//                   .replace(/_/g, " ")
//                   .replace(/\b\w/g, (char) => char.toUpperCase())}
//               </SelectItem>
//             ))}
//           </SelectContent>
//         </Select>
//       </div>

//       {category === LoanCategory.ASSET_PURCHASE ? (
//         <CommodityLoanRequest />
//       ) : category ? (
//         <CashLoanRequest />
//       ) : null}
//     </>
//   );
// }

export function LoanRequestForm() {
	const { setValue, watch } = useFormContext<OnboardCustomerType>();
	const [enableLoanSelection, setEnableLoanSelection] = React.useState(false);

	const category = watch("loan.category");

	function handleCategoryChange(newCategory: LoanCategory) {
		setValue("loan.category", newCategory);

		if (newCategory === LoanCategory.ASSET_PURCHASE) {
			setValue("loan.cashLoan", undefined);
		} else {
			setValue("loan.commodityLoan", undefined);
		}
	}

	React.useEffect(() => {
		if (!enableLoanSelection && category) setValue("loan", undefined);
	}, [enableLoanSelection, category, setValue]);

	return (
		<>
			<div className="flex items-center space-x-2 mb-4">
				<input
					type="checkbox"
					id="enable-loan-selection"
					checked={enableLoanSelection}
					onChange={(e) => setEnableLoanSelection(e.target.checked)}
					className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
				/>
				<Label
					htmlFor="enable-loan-selection"
					className="text-sm font-medium cursor-pointer">
					Apply for a loan for this customer
				</Label>
			</div>

			<div className="flex flex-col gap-3 w-full">
				<Label className="text-sm font-medium">Loan Type</Label>
				<Select
					value={category ?? ""}
					onValueChange={(value) => handleCategoryChange(value as LoanCategory)}
					disabled={!enableLoanSelection}>
					<SelectTrigger
						className={`w-full ${
							!enableLoanSelection ? "opacity-50 cursor-not-allowed" : ""
						}`}>
						<SelectValue placeholder="Select Loan Type" />
					</SelectTrigger>
					<SelectContent>
						{Object.values(LoanCategory).map((type) => (
							<SelectItem value={type} key={type}>
								{type
									.toLowerCase()
									.replace(/_/g, " ")
									.replace(/\b\w/g, (char) => char.toUpperCase())}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{enableLoanSelection && category === LoanCategory.ASSET_PURCHASE ? (
				<CommodityLoanRequest />
			) : enableLoanSelection && category ? (
				<CashLoanRequest />
			) : null}
		</>
	);
}
