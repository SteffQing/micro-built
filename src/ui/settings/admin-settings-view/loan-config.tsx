"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function LoanConfigurationCard({
  interestRate,
  managementFeeRate,
}: Pick<ConfigData, "interestRate" | "managementFeeRate">) {
  const [rates, setRates] = useState([interestRate, managementFeeRate]);
  const handleInterestRateChange = (value: string) => {
    const rate = Number.parseFloat(value);
    setRates((rates) => [rate, rates[1]]);
  };

  const handleManagementFeeRateChange = (value: string) => {
    const rate = Number.parseFloat(value);
    setRates((rates) => [rates[0], rate]);
  };

  return (
    <div className="p-3 lg:p-5 flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Label
          htmlFor="interest-rate"
          className="text-[#666666] font-normal text-sm"
        >
          Interest Rate
        </Label>
        <div className="relative">
          <Input
            id="interest-rate"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={rates[0]}
            onChange={(e) => handleInterestRateChange(e.target.value)}
            className="bg-[#FAFAFA] upy-3 px-5 rounded-xl"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label
          htmlFor="management-fee"
          className="text-[#666666] font-normal text-sm"
        >
          Management Fee
        </Label>
        <div className="relative">
          <Input
            id="management-fee"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={rates[1]}
            onChange={(e) => handleManagementFeeRateChange(e.target.value)}
            className="bg-[#FAFAFA] upy-3 px-5 rounded-xl"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
        </div>
      </div>
    </div>
  );
}
