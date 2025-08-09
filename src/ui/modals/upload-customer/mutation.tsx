import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFormContext } from "react-hook-form";
import type { OnboardCustomerType } from "./schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";

type StepType = 1 | 2 | 3 | 4 | 5 | 6;

interface Props {
  step: number;
  setStep: (step: number) => void;
}

const stepFields = {
  1: ["user.name", "user.email", "user.contact", "identity.documents"],
  2: [
    "identity.dateOfBirth",
    "identity.gender",
    "identity.maritalStatus",
    "identity.residencyAddress",
    "identity.stateResidency",
    "identity.landmarkOrBusStop",
    "identity.nextOfKinName",
    "identity.nextOfKinContact",
    "identity.nextOfKinAddress",
    "identity.nextOfKinRelationship",
  ],
  3: [
    "payroll.externalId",
    "payroll.employeeGross",
    "payroll.netPay",
    "payroll.grade",
    "payroll.step",
    "payroll.command",
  ],
  4: [
    "paymentMethod.bankName",
    "paymentMethod.accountNumber",
    "paymentMethod.accountName",
  ],
  5: [
    "loan.category",
    "loan.cashLoan.amount",
    "loan.cashLoan.tenure",
    "loan.commodityLoan.assetName",
    "loan.commodityLoan.publicDetails",
    "loan.commodityLoan.privateDetails",
    "loan.commodityLoan.amount",
    "loan.commodityLoan.tenure",
    "loan.commodityLoan.managementFeeRate",
  ],
  6: [], // review step, no validation
} as const;

export default function FooterButton({ step, setStep }: Props) {
  const { trigger } = useFormContext<OnboardCustomerType>();
  const [checked, setChecked] = useState(false);

  async function handleNext() {
    const fields = stepFields[step as StepType] || [];
    if (fields.length === 0) {
      setStep(step + 1);
      return;
    }

    const valid = await trigger(fields, { shouldFocus: true });
    if (valid) {
      setStep(step + 1);
    }
  }

  const Accept = () => (
    <div className="flex gap-3">
      <Checkbox
        id="confirmation"
        checked={checked}
        onCheckedChange={(checked) => setChecked(checked === true)}
      />
      <Label
        htmlFor="confirmation"
        className="text-[#999999] font-normal text-sm"
      >
        I confirm that the details above are accurate
      </Label>
    </div>
  );

  return (
    <DialogFooter className="flex gap-2 !p-0">
      {step > 6 && <Accept />}

      {step > 1 && step < 7 && (
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          className="flex-1 bg-[#F0F0F0] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
        >
          Back
        </Button>
      )}

      {step < 7 ? (
        <Button
          className="flex-1 rounded-[8px] p-2.5 text-white font-medium text-sm btn-gradient"
          onClick={handleNext}
        >
          Continue
        </Button>
      ) : (
        <Button className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm">
          Submit Form
        </Button>
      )}
    </DialogFooter>
  );
}
