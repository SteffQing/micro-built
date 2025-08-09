import React from "react";
import { DatePicker, InputBox, SelectBox, TextAreaBox } from "./components";
import { toast } from "sonner";
import type { OnboardCustomerType } from "../schema";
import { useFormContext } from "react-hook-form";
import FileUpload from "@/components/file-upload";
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
import { useMutation } from "@tanstack/react-query";
import { uploadCustomerFormMedia } from "@/lib/mutations/admin/customers";

interface CustomerDetailProps {
  selectedFile: File | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<File | null>>;
}

export function CustomerDetail({
  selectedFile,
  setSelectedFile,
}: CustomerDetailProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<OnboardCustomerType>();

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const { mutateAsync, isPending } = useMutation(uploadCustomerFormMedia);

  React.useEffect(() => {
    register("identity.documents");
  }, [register]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Must be jpg, png, or pdf.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error("File size must be less than 3MB");
      return;
    }

    const res = await mutateAsync(file);

    if (res.data?.url) {
      setSelectedFile(file);
      setValue("identity.documents", [res.data.url], { shouldValidate: true });
    }
  };

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

      <FileUpload
        selectedFile={selectedFile}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        error={errors.identity?.documents?.message}
        label="Signup Form"
        fileTypesLabel={["image", "pdf"]}
        accept="image/*,application/pdf"
      />
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
          label="Gross Salary"
          placeholder="Enter gross salary"
          name="payroll.employeeGross"
        />
        <InputBox
          label="Net Pay"
          placeholder="Enter net pay"
          name="payroll.netPay"
          labelPos="right"
        />
      </div>

      <div className="flex gap-4 w-full">
        <InputBox
          label="Grade"
          placeholder="Enter grade"
          name="payroll.grade"
        />
        <InputBox
          label="Step"
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
      <TextAreaBox
        label="Public Details"
        name="loan.commodityLoan.publicDetails"
        placeholder="Enter public details"
      />
      <TextAreaBox
        label="Private Details"
        name="loan.commodityLoan.privateDetails"
        placeholder="Enter private details"
      />
      <InputBox
        label="Amount"
        name="loan.commodityLoan.amount"
        type="number"
        placeholder="Enter amount"
      />
      <InputBox
        label="Tenure (months)"
        name="loan.commodityLoan.tenure"
        type="number"
        placeholder="Enter tenure"
      />
      <InputBox
        label="Management Fee Rate (%)"
        name="loan.commodityLoan.managementFeeRate"
        type="number"
        placeholder="Enter percentage"
      />
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
    </div>
  );
}

export function LoanRequestForm() {
  const { setValue, watch } = useFormContext<OnboardCustomerType>();

  const category = watch("loan.category");

  function handleCategoryChange(newCategory: LoanCategory) {
    setValue("loan.category", newCategory);

    if (newCategory === LoanCategory.ASSET_PURCHASE) {
      setValue("loan.cashLoan", undefined);
    } else {
      setValue("loan.commodityLoan", undefined);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 w-full">
        <Label className="text-sm font-medium">Loan Type</Label>
        <Select
          value={category ?? ""}
          onValueChange={(value) => handleCategoryChange(value as LoanCategory)}
        >
          <SelectTrigger className="w-full">
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

      {category === LoanCategory.ASSET_PURCHASE ? (
        <CommodityLoanRequest />
      ) : category ? (
        <CashLoanRequest />
      ) : null}
    </>
  );
}
