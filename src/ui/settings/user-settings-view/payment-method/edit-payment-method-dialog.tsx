import { AlertCircle, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BankSelector } from "./bank-selector";
import { Bank } from "./types";

interface EditPaymentMethodModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  banks: Bank[];
  selectedBank: Bank | null;
  onBankSelect: (bank: Bank) => void;
  bankSearchOpen: boolean;
  setBankSearchOpen: (open: boolean) => void;
  accountNumber: string;
  setAccountNumber: (number: string) => void;
  accountName: string;
  isVerifying: boolean;
  isVerified: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: () => void;
}

export function EditPaymentMethodModal({
  isOpen,
  onOpenChange,
  banks,
  selectedBank,
  onBankSelect,
  bankSearchOpen,
  setBankSearchOpen,
  accountNumber,
  setAccountNumber,
  accountName,
  isVerifying,
  isVerified,
  isSaving,
  error,
  onSave,
}: EditPaymentMethodModalProps) {
  const handleBankSelect = (bank: Bank) => {
    onBankSelect(bank);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Payment Method</DialogTitle>
          <DialogDescription>
            Edit your bank account details to change your payment method.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <BankSelector
            banks={banks}
            selectedBank={selectedBank}
            onBankSelect={handleBankSelect}
            isOpen={bankSearchOpen}
            onOpenChange={setBankSearchOpen}
          />

          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="modalAccountName">Account Name</Label>
            <div className="relative">
              <Input
                id="modalAccountName"
                value={accountName}
                // readOnly
                placeholder="Enter your account name"
                className="bg-gray-50"
              />
              {isVerified && accountName && (
                <Badge className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-green-100 text-green-700">
                  Verified
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span>Bank account name must match the name on the ID</span>
            </div>
          </div>

          {/* Account Number */}
          <div className="space-y-2">
            <Label htmlFor="modalAccountNumber">Account Number</Label>
            <div className="relative">
              <Input
                id="modalAccountNumber"
                value={accountNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setAccountNumber(value);
                }}
                placeholder="Enter your account number"
                maxLength={10}
              />
              {isVerifying && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
              {isVerified && accountName && (
                <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col gap-3 flex">
          <div className="flex flex-col gap-2 mx-auto">
            <Button
              onClick={onSave}
              disabled={
                !selectedBank ||
                !accountNumber ||
                !accountName ||
                !isVerified ||
                isSaving
              }
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Ensure that all the details above are filled correctly before
              proceeding.
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
