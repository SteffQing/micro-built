"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserMutation } from "@/hooks/api/use-user";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ConfigData {
  interestRate: number;
  managementFeeRate: number;
}

export default function LoanConfigurationCard({
  interestRate,
  managementFeeRate,
}: Pick<ConfigData, "interestRate" | "managementFeeRate">) {
  console.log({ interestRate, managementFeeRate });
  const [rates, setRates] = useState([interestRate, managementFeeRate]);
  console.log({ rates });
  const { updateRate } = useUserMutation();
  const [hasChanges, setHasChanges] = useState(false);

  const handleRateChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newRates = [...rates];
    newRates[index] = numValue;
    setRates(newRates);
    setHasChanges(true);
  };

  const handleSave = async (
    type: "INTEREST_RATE" | "MANAGEMENT_FEE_RATE",
    rate: number
  ) => {
    try {
      await updateRate.mutateAsync({ type, rate });
      setHasChanges(false);
      toast.success("Rate updated successfully!");
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="p-3 lg:p-5 flex flex-col gap-8">
      {/* Interest Rate Section */}
      <div className="flex flex-col gap-3">
        <Label
          htmlFor="interest-rate"
          className="text-muted-foreground font-normal text-sm"
        >
          Interest Rate
        </Label>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              id="interest-rate"
              type="number"
              value={hasChanges ? rates[0] : interestRate}
              onChange={(e) => handleRateChange(0, e.target.value)}
              className="bg-[#FAFAFA] py-3 px-5 rounded-xl w-full"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
          <Button
            onClick={() => handleSave("INTEREST_RATE", rates[0])}
            disabled={!hasChanges || updateRate.isPending}
            className="whitespace-nowrap"
          >
            {updateRate.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
              </>
            ) : hasChanges ? (
              "Save Changes"
            ) : (
              "Make Changes Now"
            )}
          </Button>
        </div>
      </div>

      {/* Management Fee Section */}
      <div className="flex flex-col gap-3">
        <Label
          htmlFor="management-fee"
          className="text-muted-foreground font-normal text-sm"
        >
          Management Fee
        </Label>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              id="management-fee"
              type="number"
              value={hasChanges ? rates[1] : managementFeeRate}
              onChange={(e) => handleRateChange(1, e.target.value)}
              className="bg-[#FAFAFA] py-3 px-5 rounded-xl w-full"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
          <Button
            onClick={() => handleSave("MANAGEMENT_FEE_RATE", rates[1])}
            disabled={!hasChanges || updateRate.isPending}
            className="whitespace-nowrap"
          >
            {updateRate.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
              </>
            ) : hasChanges ? (
              "Save Changes"
            ) : (
              "Make Changes Now"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
