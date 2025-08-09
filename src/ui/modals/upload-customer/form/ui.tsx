import React from "react";
import { DatePicker, InputBox, SelectBox } from "./components";
import { toast } from "sonner";
import type { OnboardCustomerType } from "../schema";
import { useFormContext } from "react-hook-form";
import FileUpload from "@/components/file-upload";
import { Gender, MaritalStatus, Relationship } from "@/config/enums";

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

    // Simulate upload API
    const fakeUrl = `https://files.example.com/${file.name}`;
    setSelectedFile(file);
    setValue("identity.documents", [fakeUrl], { shouldValidate: true });
    toast.success(`${file.name} uploaded successfully`);
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

      <div className="flex gap-4">
        <SelectBox
          label="Gender"
          name="identity.gender"
          options={Object.values(Gender).map((value) => ({
            label: value,
            value,
          }))}
          className="w-full"
        />

        <SelectBox
          label="Marital Status"
          name="identity.maritalStatus"
          options={Object.values(MaritalStatus).map((value) => ({
            label: value,
            value,
          }))}
          className="w-full"
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
        />
      </div>

      <InputBox
        label="Next of Kin Name"
        placeholder="Enter next of kin's name"
        name="identity.nextOfKinName"
      />

      <InputBox
        label="Next of Kin Address"
        placeholder="Enter address"
        name="identity.nextOfKinAddress"
      />

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
        />
      </div>
    </>
  );
}
