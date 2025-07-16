"use client";

import { Building2, Edit2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
// import type { PaymentMethodData } from "@/types/payment-method";

interface PaymentDisplayProps {
  paymentMethod: PaymentMethodData;
  onEdit: () => void;
}

export interface PaymentMethodData {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export function PaymentDisplay({ paymentMethod, onEdit }: PaymentDisplayProps) {
  console.log({ paymentMethod });
  return (
    <div className="max-w-4xl">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-2">Payment Method</h2>
        <p className="text-muted-foreground mb-6">
          Update your bank account information to change your payment method.
        </p>
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-orange-600" />
              </div>
              <span className="font-medium">{paymentMethod.bankName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="text-destructive"
            >
              <Edit2 className="w-4 h-4" />
              Edit Details
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="displayAccountName">Account Name</Label>
              <Input
                id="displayAccountName"
                value={paymentMethod.accountName}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayAccountNumber">Account Number</Label>
              <Input
                id="displayAccountNumber"
                value={paymentMethod.accountNumber}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>
          <Alert className="mt-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              Payment method can only be updated every 30 days.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
