import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmPaymentMethodModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function ConfirmPaymentMethodModal({
  isOpen,
  onOpenChange,
  onConfirm,
  onCancel,
  isSaving,
}: ConfirmPaymentMethodModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Payment Method</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-gray-600">
            Are you sure you want to change your payment method? Ensure that
            your bank details are correct before proceeding.
          </p>
        </div>

        <DialogFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 bg-transparent"
          >
            No, Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirming...
              </>
            ) : (
              "Yes, Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
