"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const InterestRateCard = () => {
  const [interestRate, setInterestRate] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("");
  const [applyRecurring, setApplyRecurring] = useState(false);
  const [oneOffPayments, setOneOffPayments] = useState(false);

  const handleApplyChanges = () => {
    console.log({
      interestRate,
      amount,
      frequency,
      applyRecurring,
      oneOffPayments,
    });
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-medium text-gray-900">
          Interest Rate
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Interest Rate Dropdown */}
        <div className="space-y-2">
          <Select value={interestRate} onValueChange={setInterestRate}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Interest Rate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12% per Annum</SelectItem>
              <SelectItem value="15">15% per Annum</SelectItem>
              <SelectItem value="20">20% per Annum</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Management Charges Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">
            Configure Management Charges
          </h3>

          {/* Amount Input */}
          <div className="space-y-2">
            <Input
              type="number"
              placeholder="Enter Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Frequency Dropdown */}
          <div className="space-y-2">
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Monthly" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={applyRecurring}
                onCheckedChange={(checked) =>
                  setApplyRecurring(checked === true)
                }
              />
              <Label
                htmlFor="recurring"
                className="text-sm text-gray-600 cursor-pointer"
              >
                Apply Recurring Charges
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="oneoff"
                checked={oneOffPayments}
                onCheckedChange={(checked) =>
                  setOneOffPayments(checked === true)
                }
              />
              <Label
                htmlFor="oneoff"
                className="text-sm text-gray-600 cursor-pointer"
              >
                One-off payments
              </Label>
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <Button
          onClick={handleApplyChanges}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5"
        >
          Apply Changes
        </Button>
      </CardContent>
    </Card>
  );
};

export default InterestRateCard;
