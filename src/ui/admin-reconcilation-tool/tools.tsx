"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RotateCcw,
  ArrowLeftRight,
  Download,
  Bell,
  MoreHorizontal,
  Search,
} from "lucide-react";

interface AdjustmentFormData {
  loanId: string;
  newAmount: string;
  reason: string;
}

const ReconcilationToolCards: React.FC = () => {
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormData>({
    loanId: "",
    newAmount: "",
    reason: "",
  });

  const handleToolAction = (action: string) => {
    console.log(`Executing: ${action}`);
    // Tool actions would be implemented here
  };

  const handleAdjustmentSubmit = () => {
    console.log("Submitting adjustment:", adjustmentForm);
    // Form submission logic would go here

    // Reset form after submission
    setAdjustmentForm({
      loanId: "",
      newAmount: "",
      reason: "",
    });
  };

  const handleInputChange = (
    field: keyof AdjustmentFormData,
    value: string
  ) => {
    setAdjustmentForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toolButtons = [
    {
      icon: <RotateCcw className="w-4 h-4" />,
      label: "Auto Reconcile",
      action: "auto-reconcile",
      variant: "secondary" as const,
    },
    {
      icon: <ArrowLeftRight className="w-4 h-4" />,
      label: "Match Batch Payments",
      action: "match-batch-payments",
      variant: "secondary" as const,
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: "Download CSV",
      action: "download-csv",
      variant: "secondary" as const,
    },
    {
      icon: <Bell className="w-4 h-4" />,
      label: "Notify Loan Officer",
      action: "notify-loan-officer",
      variant: "secondary" as const,
    },
  ];

  return (
    <div className="col-span-2 space-y-4">
      {/* Tools Card */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Tools</CardTitle>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {toolButtons.map((tool, index) => (
            <Button
              variant="outline"
              key={index}
              className="border-2 border-secondary text-primary"
              onClick={() => handleToolAction(tool.action)}
            >
              {tool.icon}
              {tool.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Adjustments Card */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Adjustments</CardTitle>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Fill the form below to manually adjust entries
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Select Loan ID"
              value={adjustmentForm.loanId}
              onChange={(e) => handleInputChange("loanId", e.target.value)}
              className="pl-10"
            />
          </div>

          <Input
            placeholder="Enter New Amount"
            value={adjustmentForm.newAmount}
            onChange={(e) => handleInputChange("newAmount", e.target.value)}
            type="number"
          />

          <Textarea
            placeholder="Reason"
            value={adjustmentForm.reason}
            onChange={(e) => handleInputChange("reason", e.target.value)}
            className="min-h-[80px] resize-none"
          />

          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={handleAdjustmentSubmit}
            disabled={
              !adjustmentForm.loanId ||
              !adjustmentForm.newAmount ||
              !adjustmentForm.reason
            }
          >
            Submit
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReconcilationToolCards;
