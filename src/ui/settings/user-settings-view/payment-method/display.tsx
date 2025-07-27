import { Building2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PaymentMethodDisplay({ bankName, accountNumber, accountName }: UserPaymentMethodDto) {
  return (
    <div className="max-w-4xl">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-2">Payment Method</h2>

        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-orange-600" />
              </div>
              <span className="font-medium">{bankName}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="displayAccountName">Account Name</Label>
              <Input id="displayAccountName" value={accountName} readOnly className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayAccountNumber">Account Number</Label>
              <Input id="displayAccountNumber" value={accountNumber} readOnly className="bg-gray-50" />
            </div>
          </div>

          <Alert className="mt-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              Payment method can only be updated by contacting our support team.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
