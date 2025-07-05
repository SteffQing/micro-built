"use client";

import * as React from "react";
import { Check, ChevronLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface LoanFormData {
  loanType: string;
  amount: string;
  tenure: string;
  purpose: string;
}

interface DocumentUpload {
  proofOfIdentity: File | null;
  proofOfEmployment: File | null;
  proofOfResidence: File | null;
}

const loanTypes = [
  "Personal Loan",
  "Home Loan",
  "Car Loan",
  "Business Loan",
  "Education Loan",
];

export default function LoanApplicationDialog() {
  const [open, setOpen] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(1);
  const [formData, setFormData] = React.useState<LoanFormData>({
    loanType: "",
    amount: "",
    tenure: "",
    purpose: "",
  });
  const [documents, setDocuments] = React.useState<DocumentUpload>({
    proofOfIdentity: null,
    proofOfEmployment: null,
    proofOfResidence: null,
  });
  const [confirmTerms, setConfirmTerms] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const handleInputChange = (field: keyof LoanFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field: keyof DocumentUpload, file: File | null) => {
    setDocuments((prev) => ({ ...prev, [field]: file }));
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
  };

  const resetDialog = () => {
    setCurrentStep(1);
    setFormData({
      loanType: "",
      amount: "",
      tenure: "",
      purpose: "",
    });
    setDocuments({
      proofOfIdentity: null,
      proofOfEmployment: null,
      proofOfResidence: null,
    });
    setConfirmTerms(false);
    setIsSubmitted(false);
    setOpen(false);
  };

  const isStep1Valid =
    formData.loanType && formData.amount && formData.tenure && formData.purpose;
  const isStep2Valid =
    documents.proofOfIdentity &&
    documents.proofOfEmployment &&
    documents.proofOfResidence;

  const StepIndicator = ({
    step,
    label,
    isActive,
    isCompleted,
  }: {
    step: number;
    label: string;
    isActive: boolean;
    isCompleted: boolean;
  }) => (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2",
          isCompleted
            ? "bg-green-600 border-green-600 text-white"
            : isActive
            ? "bg-green-600 border-green-600 text-white"
            : "border-gray-300 text-gray-500"
        )}
      >
        {isCompleted ? <Check className="w-4 h-4" /> : step}
      </div>
      <span
        className={cn(
          "text-xs text-center",
          isActive ? "text-green-600 font-medium" : "text-gray-500"
        )}
      >
        {label}
      </span>
    </div>
  );

  const FileUploadSection = ({
    title,
    subtitle,
    field,
    acceptedTypes,
  }: {
    title: string;
    subtitle: string;
    field: keyof DocumentUpload;
    acceptedTypes: string;
  }) => (
    <div className="space-y-2">
      <h3 className="font-medium text-gray-900">{title}</h3>
      <div className="border-2 border-dashed border-green-200 rounded-lg p-6 bg-green-50">
        <div className="text-center">
          <Upload className="mx-auto h-6 w-6 text-green-600 mb-2" />
          <Button
            variant="ghost"
            className="text-green-600 hover:text-green-700"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pdf,.jpg,.jpeg,.png";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileUpload(field, file);
              };
              input.click();
            }}
          >
            Upload Document
          </Button>
          {documents[field] && (
            <p className="text-sm text-green-600 mt-1">
              ✓ {documents[field]?.name}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500">{acceptedTypes}</p>
    </div>
  );

  if (isSubmitted) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-green-600 hover:bg-green-700">
            Start new Loan
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Application Submitted Successfully
            </h2>
            <p className="text-gray-600 mb-6">
              We've received your loan request. You'll be notified once it's
              reviewed by our team
            </p>
            <div className="space-y-3">
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={resetDialog}
              >
                Return to Dashboard
              </Button>
              <Button
                variant="ghost"
                className="w-full text-green-600 hover:text-green-700"
                onClick={resetDialog}
              >
                Track Application
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          Start new Loan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          {currentStep > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-0 top-0 p-1"
              onClick={handleBack}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <DialogTitle className="text-center">
            {currentStep === 1 && "Loan Application"}
            {currentStep === 2 && "Upload Documents"}
            {currentStep === 3 && "Confirm Details"}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex justify-center gap-8 mb-6">
          <StepIndicator
            step={1}
            label="Loan Details"
            isActive={currentStep === 1}
            isCompleted={currentStep > 1}
          />
          <StepIndicator
            step={2}
            label="Upload Documents"
            isActive={currentStep === 2}
            isCompleted={currentStep > 2}
          />
          <StepIndicator
            step={3}
            label="Confirmation"
            isActive={currentStep === 3}
            isCompleted={false}
          />
        </div>

        {/* Step 1: Loan Details */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Please provide the information below before proceeding
            </p>

            <div className="space-y-2">
              <Label htmlFor="loanType">Loan Type</Label>
              <Select
                value={formData.loanType}
                onValueChange={(value) => handleInputChange("loanType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Loan Type" />
                </SelectTrigger>
                <SelectContent>
                  {loanTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                placeholder="Enter Loan Amount"
                value={formData.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenure">Tenure</Label>
              <Input
                id="tenure"
                placeholder="Enter Loan Tenure"
                value={formData.tenure}
                onChange={(e) => handleInputChange("tenure", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <Textarea
                id="purpose"
                placeholder="Your purpose for making this request"
                value={formData.purpose}
                onChange={(e) => handleInputChange("purpose", e.target.value)}
                rows={4}
              />
            </div>

            <Button
              className="w-full mt-6"
              onClick={handleNext}
              disabled={!isStep1Valid}
            >
              Continue
            </Button>

            <p className="text-xs text-center text-gray-500 mt-4">
              By clicking "Continue", you agree to MicroBull's{" "}
              <span className="text-green-600 underline cursor-pointer">
                Terms of Use
              </span>{" "}
              and{" "}
              <span className="text-green-600 underline cursor-pointer">
                Privacy Policy
              </span>
            </p>
          </div>
        )}

        {/* Step 2: Upload Documents */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600 mb-4">
              Please upload any of the following document.
            </p>

            <FileUploadSection
              title="Proof of Identity"
              subtitle=""
              field="proofOfIdentity"
              acceptedTypes="National ID, Passport, Driver's License"
            />

            <FileUploadSection
              title="Proof of Employment/Income"
              subtitle=""
              field="proofOfEmployment"
              acceptedTypes="Bank Statement"
            />

            <FileUploadSection
              title="Proof of Residence"
              subtitle=""
              field="proofOfResidence"
              acceptedTypes="Utility Bills"
            />

            <Button
              className="w-full mt-6"
              onClick={handleNext}
              disabled={!isStep2Valid}
            >
              Submit
            </Button>

            <p className="text-xs text-center text-gray-500 mt-4">
              By clicking "Continue", you agree to MicroBull's{" "}
              <span className="text-green-600 underline cursor-pointer">
                Terms of Use
              </span>{" "}
              and{" "}
              <span className="text-green-600 underline cursor-pointer">
                Privacy Policy
              </span>
            </p>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">
                Are you sure you want to proceed?
              </h3>
              <p className="text-sm text-gray-600">
                Ensure that your details are correct before submission. You can
                go back to edit if need
              </p>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={confirmTerms}
                onCheckedChange={(checked) =>
                  setConfirmTerms(checked as boolean)
                }
              />
              <Label
                htmlFor="terms"
                className="text-sm text-gray-600 leading-relaxed"
              >
                I confirm that the details above are accurate and I agree to the
                terms and conditions.
              </Label>
            </div>

            <Button
              className="w-full mt-6"
              onClick={handleSubmit}
              disabled={!confirmTerms}
            >
              Confirm
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
