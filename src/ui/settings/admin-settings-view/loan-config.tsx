"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoanConfigurationCard() {
  const handleInterestRateChange = (value: string) => {
    // const rate = Number.parseFloat(value) || 0;
    // onConfigurationChange({ ...configuration, interestRate: rate });
  };

  const handleManagementFeeChange = (value: string) => {
    // const fee = Number.parseFloat(value) || 0;
    // onConfigurationChange({ ...configuration, managementFee: fee });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Loan Configuration (Defaults)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="interest-rate">Interest Rate</Label>
          <div className="relative">
            <Input
              id="interest-rate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={configuration.interestRate}
              onChange={(e) => handleInterestRateChange(e.target.value)}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="management-fee">Management Fee</Label>
          <div className="relative">
            <Input
              id="management-fee"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={configuration.managementFee}
              onChange={(e) => handleManagementFeeChange(e.target.value)}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
