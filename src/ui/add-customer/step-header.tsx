import { cn } from "@/lib/utils";
import { LoanIcons } from "@/components/svg/loan";

const steps = [
  { number: 1, label: "Customer Details" },
  { number: 2, label: "Identity Info" },
  { number: 3, label: "Payroll Info" },
  { number: 4, label: "Payment Info" },
  { number: 5, label: "Loan Details" },
  { number: 6, label: "Preview" },
] as const;
export interface RequestModalContentHeaderProps {
  step: number;
}
function RequestModalContentHeader({ step }: RequestModalContentHeaderProps) {
  return (
    <div className="grid grid-cols-3 gap-6 justify-between items-center max-w-2xl mx-auto">
      {steps.map(({ number, label }) => {
        const isPast = step > number;
        const isCurrent = step === number;

        return (
          <div key={number} className="flex gap-4 flex-col items-center">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
                isCurrent && "btn-gradient text-primary-foreground",
                isPast && "bg-green-100 border border-green-500 text-green-700",
                !isPast &&
                  !isCurrent &&
                  "border-2 border-dashed border-red-800 text-red-800"
              )}
            >
              {isPast ? "✓" : number}
            </div>
            <p
              className={cn(
                "text-sm text-center",
                isCurrent
                  ? "text-[#8A0806] font-medium"
                  : isPast
                  ? "text-green-700 font-medium"
                  : "text-muted-foreground font-normal"
              )}
            >
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function FormSubmissionSuccess() {
  return (
    <div className="flex flex-col gap-6 items-center py-8">
      <div className="flex items-center justify-center">
        <LoanIcons.successful_application />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-[#333333] font-semibold text-2xl">
          Customer Uploaded Successfully
        </h2>
        <p className="text-[#999999] font-normal text-sm max-w-md">
          The customer details have been successfully uploaded to the system.
        </p>
      </div>
    </div>
  );
}

export { RequestModalContentHeader, FormSubmissionSuccess };
