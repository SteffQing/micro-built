import { Building2, Loader2 } from "lucide-react";

export function PaymentMethodEmpty() {
  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-2">Payment Method</h2>
        <p className="text-muted-foreground mb-8">Add your bank account information for payments.</p>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Bank Account Added</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Contact our support tean to add your bank account details to receive payments and manage your finances.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PaymentMethodLoading() {
  return (
    <div className="max-w-4xl">
      <div className="rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
