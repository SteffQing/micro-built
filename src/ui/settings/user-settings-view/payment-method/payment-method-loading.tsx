import { Loader2 } from "lucide-react";

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
