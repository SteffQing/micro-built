"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ChevronLeft,
  Check,
  Loader2,
  DollarSign,
  CheckCircle,
} from "lucide-react";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { AxiosError } from "axios";

export interface LoanApplication {
  amount: number;
  category: LoanCategory;
}

export type LoanCategory =
  | "PERSONAL"
  | "EDUCATION"
  | "BUSINESS"
  | "MEDICAL"
  | "RENT"
  | "TRAVEL"
  | "AGRICULTURE"
  | "UTILITIES"
  | "EMERGENCY"
  | "ASSET_PURCHASE"
  | "OTHERS";

export interface LoanApplicationResponse {
  message: string;
  data: {
    id: string;
    repayable: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

const loanCategories: { value: LoanCategory; label: string }[] = [
  { value: "EDUCATION", label: "Education" },
  { value: "PERSONAL", label: "Personal" },
  { value: "BUSINESS", label: "Business" },
  { value: "MEDICAL", label: "Medical" },
  { value: "RENT", label: "Rent" },
  { value: "TRAVEL", label: "Travel" },
  { value: "AGRICULTURE", label: "Agriculture" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "OTHERS", label: "Others" },
  { value: "ASSET_PURCHASE", label: "Asset Purchase" },
];

const loanTypes = [
  { value: "personal", label: "Personal Loan" },
  { value: "business", label: "Business Loan" },
  { value: "mortgage", label: "Mortgage Loan" },
  { value: "auto", label: "Auto Loan" },
];

const formSchema = z.object({
  loanType: z.string().min(1, "Please select a loan type"),
  category: z.string().min(1, "Please select a loan category"),
  amount: z
    .number()
    .min(1000, "Minimum loan amount is $1,000")
    .max(1000000, "Maximum loan amount is $1,000,000"),
});

type FormData = z.infer<typeof formSchema>;

export function LoanApplicationModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const submitLoanApplication = async (
    data: LoanApplication
  ): Promise<LoanApplicationResponse> => {
    try {
      const response = await api.post("/user/loan", data);
      return response.data;
    } catch (error: unknown) {
      const errorMessage =
        (error instanceof AxiosError && error.response?.data?.message) ||
        (error instanceof Error && error.message) ||
        "An error occurred";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const mutation = useMutation({
    mutationFn: submitLoanApplication,
    onSuccess: (data) => {
      toast.success("Loan application submitted successfully!");
      setStep(4);
      console.log("Loan application submitted successfully:", data);
    },
    onError: (error) => {
      console.error("Loan application failed:", error);
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      loanType: "",
      category: "",
      amount: undefined,
    },
  });

  const onSubmit = async (data: FormData) => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3 && isConfirmed) {
      setIsLoading(true);
      try {
        console.log({ data });
        await mutation.mutateAsync({
          amount: data.amount,
          category: data.category as LoanCategory,
        });
      } catch (error) {
        console.error("Loan application failed:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClose = () => {
    setStep(1);
    setIsConfirmed(false);
    form.reset();
    setOpen(false);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-6 mb-1">
      {[1, 2, 3].map((stepNumber) => (
        <div key={stepNumber} className="flex items-center">
          <div
            className={`w-8 h-8  rounded-full flex items-center justify-center text-sm font-medium ${
              stepNumber < step
                ? "bg-primary text-primary-foreground border-dotted border-primary border-2"
                : stepNumber === step
                ? "bg-primary text-primary-foreground border-dotted border-primary border-2"
                : "bg-muted text-muted-foreground border-dotted border-primary border-2"
            }`}
          >
            {stepNumber < step ? <Check className="w-4 h-4" /> : stepNumber}
          </div>
          {stepNumber < 3 && (
            <div
              className={`w-8 h-0.5 mx-2 ${
                stepNumber < step ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStepLabels = () => (
    <div className="flex gap-6 items-center text-xs text-muted-foreground mx-auto w-full justify-center">
      <span className={step >= 1 ? "text-primary font-medium" : ""}>
        Loan Details
      </span>
      <span className={step >= 2 ? "text-primary font-medium" : ""}>
        Upload Documents
      </span>
      <span className={step >= 3 ? "text-primary font-medium" : ""}>
        Confirmation
      </span>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-start mb-6">
        <p className="text-sm text-muted-foreground">
          Please provide the information below before proceeding
        </p>
      </div>

      <FormField
        control={form.control}
        name="loanType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Loan Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Loan Type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {loanTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="category"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Loan Category</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Loan Category" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <div className="grid grid-cols-3 gap-2 p-2">
                  {loanCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <span className="text-sm">{category.label}</span>
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Loan Amount</FormLabel>
            <FormControl>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Enter Loan Amount"
                  className="pl-10"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Upload Documents</h3>
        <p className="text-sm text-muted-foreground">
          Please upload the required documents for verification
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : (
          <></>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Confirm Details</h3>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to proceed?
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Ensure that your details are correct before submission. You can go
          back to edit if needed.
        </p>
      </div>

      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Loan Type:</span>
          <span className="text-sm font-medium">
            {
              loanTypes.find((t) => t.value === form.getValues("loanType"))
                ?.label
            }
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Category:</span>
          <span className="text-sm font-medium">
            {
              loanCategories.find((c) => c.value === form.getValues("category"))
                ?.label
            }
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Amount:</span>
          <span className="text-sm font-medium">
            ${form.getValues("amount").toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="confirm"
          checked={isConfirmed}
          onCheckedChange={(checked) => setIsConfirmed(checked === true)}
        />
        <Label htmlFor="confirm" className="text-sm">
          I confirm that the details above are accurate and I agree to the terms
          and conditions.
        </Label>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-primary-foreground" />
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-2">
          Application Submitted Successfully
        </h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ve received your loan request. You&apos;ll be notified once
          it&apos;s reviewed by our team.
        </p>
      </div>
      <div className="space-y-3">
        <Button onClick={handleClose} className="w-full">
          Return to Dashboard
        </Button>
        <Button variant="outline" className="w-full bg-transparent">
          Track Application
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New Loan Request</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="relative">
          <DialogTitle className="text-center">
            {step === 4 ? "" : "Loan Application"}
          </DialogTitle>
          {step < 4 && (
            <>
              {step > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-0 top-0"
                  onClick={handleBack}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </DialogHeader>

        <Separator />
        <div className="py-2">
          {step < 4 && (
            <>
              {renderStepIndicator()}
              {renderStepLabels()}
            </>
          )}
        </div>
        <Separator />

        <div className="py-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}

              {step < 4 && (
                <div className="flex flex-col space-y-4">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      (step === 3 && !isConfirmed) ||
                      isLoading ||
                      mutation.isPending
                    }
                  >
                    {isLoading || mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {step === 3 ? "Submitting..." : "Processing..."}
                      </>
                    ) : step === 3 ? (
                      "Confirm"
                    ) : (
                      "Continue"
                    )}
                  </Button>

                  {step === 1 && (
                    <p className="text-xs text-center text-muted-foreground">
                      By clicking &apos;Continue&apos;, you agree to our{" "}
                      <span className="text-primary underline cursor-pointer">
                        Terms of Use
                      </span>{" "}
                      and{" "}
                      <span className="text-primary underline cursor-pointer">
                        Privacy Policy
                      </span>
                    </p>
                  )}
                </div>
              )}
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
