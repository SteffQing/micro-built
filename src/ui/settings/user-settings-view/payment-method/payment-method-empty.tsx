// components/PaymentMethodEmpty.tsx
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentMethodEmptyProps {
  onAddClick: () => void;
}

export function PaymentMethodEmpty({ onAddClick }: PaymentMethodEmptyProps) {
  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-2">Payment Method</h2>
        <p className="text-muted-foreground mb-8">
          Add your bank account information for payments.
        </p>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Bank Account Added</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Add your bank account details to receive payments and manage your
            finances.
          </p>
          <Button onClick={onAddClick} className="flex items-center gap-1">
            <Plus className="w-3 h-3" />
            Add Bank Account
          </Button>
        </div>
      </div>
    </div>
  );
}
