"use client";

import { useState, useEffect } from "react";
import {
  Edit2,
  Building2,
  AlertCircle,
  Check,
  Loader2,
  Search,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Bank {
  id: number;
  name: string;
  code: string;
  slug: string;
}

interface PaymentMethodData {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface VerifyAccountResponse {
  account_name: string;
  account_number: string;
}

export function PaymentMethod() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodData | null>(
    null
  );
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [bankSearchOpen, setBankSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChanges, setPendingChanges] =
    useState<PaymentMethodData | null>(null);

  // Fetch user's existing payment method
  useEffect(() => {
    fetchPaymentMethod();
  }, []);

  // Fetch banks list from Paystack
  useEffect(() => {
    fetchBanks();
  }, []);

  // Debounced account verification
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      const timer = setTimeout(() => {
        verifyAccount();
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setAccountName("");
      setIsVerified(false);
    }
  }, [accountNumber, selectedBank]);

  const fetchPaymentMethod = async () => {
    try {
      const response = await fetch("/api/user/payment-method");
      if (response.ok) {
        const data = await response.json();
        setPaymentMethod(data);
        // Find the bank from the banks list
        const bank = banks.find((b) => b.name === data.bankName);
        if (bank) {
          setSelectedBank(bank);
        }
        setAccountNumber(data.accountNumber);
        setAccountName(data.accountName);
        setIsVerified(true);
      } else if (response.status === 404) {
        // No payment method found - show empty state
        setPaymentMethod(null);
      }
    } catch (error) {
      console.error("Error fetching payment method:", error);
      setError("Failed to load payment method");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBanks = async () => {
    try {
      const response = await fetch("https://api.paystack.co/bank");
      const data = await response.json();
      if (data.status) {
        setBanks(data.data);
      }
    } catch (error) {
      console.error("Error fetching banks:", error);
      toast.error("Error", {
        description: "Failed to load banks list",
      });
    }
  };

  const verifyAccount = async () => {
    if (!selectedBank || accountNumber.length !== 10) return;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${selectedBank.code}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY}`,
          },
        }
      );

      const data = await response.json();

      if (data.status && data.data) {
        setAccountName(data.data.account_name);
        setIsVerified(true);
        // Auto-save if this is a new payment method
        if (!paymentMethod) {
          await savePaymentMethod({
            bankName: selectedBank.name,
            accountNumber,
            accountName: data.data.account_name,
          });
        }
      } else {
        setError("Unable to verify account. Please check your details.");
        setIsVerified(false);
      }
    } catch (error) {
      console.error("Error verifying account:", error);
      setError("Failed to verify account");
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const savePaymentMethod = async (data: PaymentMethodData) => {
    setIsSaving(true);
    setError(null);

    try {
      const method = paymentMethod ? "PATCH" : "POST";
      const response = await fetch("/api/user/payment-method", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const savedData = await response.json();
        setPaymentMethod(savedData);
        setIsEditMode(false);
        toast.success("Success", {
          description: paymentMethod
            ? "Payment method updated successfully"
            : "Payment method added successfully",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save payment method");
      }
    } catch (error) {
      console.error("Error saving payment method:", error);
      setError(
        error instanceof Error ? error.message : "Failed to save payment method"
      );
      toast.error("Error", {
        description: "Failed to save payment method",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
    setError(null);
  };

  const handleModalSave = () => {
    if (!selectedBank || !accountNumber || !accountName || !isVerified) {
      setError("Please complete all fields and verify your account");
      return;
    }

    const changes = {
      bankName: selectedBank.name,
      accountNumber,
      accountName,
    };

    setPendingChanges(changes);
    setShowEditModal(false);
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (pendingChanges) {
      await savePaymentMethod(pendingChanges);
      setShowConfirmModal(false);
      setPendingChanges(null);
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setPendingChanges(null);
    setShowEditModal(true);
  };

  const handleCancel = () => {
    if (paymentMethod) {
      // Reset to original values
      const bank = banks.find((b) => b.name === paymentMethod.bankName);
      setSelectedBank(bank || null);
      setAccountNumber(paymentMethod.accountNumber);
      setAccountName(paymentMethod.accountName);
      setIsVerified(true);
    } else {
      // Clear form
      setSelectedBank(null);
      setAccountNumber("");
      setAccountName("");
      setIsVerified(false);
    }
    setIsEditMode(false);
    setError(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    handleCancel();
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  // Empty State - No payment method exists
  if (!paymentMethod && !isEditMode) {
    return (
      <div className="max-w-4xl">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Payment Method
          </h2>
          <p className="text-gray-600 mb-8">
            Add your bank account information for payments.
          </p>

          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Bank Account Added
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Add your bank account details to receive payments and manage your
              finances.
            </p>
            <Button
              onClick={() => setIsEditMode(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Bank Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Display Mode - Show existing payment method
  return (
    <div className="max-w-4xl">
      <div className=" p-6">
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
              <span className="font-medium ">{paymentMethod?.bankName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
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
                value={paymentMethod?.accountName}
                readOnly
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayAccountNumber">Account Number</Label>
              <Input
                id="displayAccountNumber"
                value={paymentMethod?.accountNumber}
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

      {/* Edit Payment Method Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment Method</DialogTitle>
            <DialogDescription>
              Edit your bank account details to change your payment method.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Bank Selection */}
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Popover open={bankSearchOpen} onOpenChange={setBankSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={bankSearchOpen}
                    className="w-full justify-between bg-transparent"
                  >
                    {selectedBank ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {selectedBank.name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Enter your bank name
                      </span>
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search banks..." />
                    <CommandList>
                      <CommandEmpty>No bank found.</CommandEmpty>
                      <CommandGroup>
                        {banks.map((bank) => (
                          <CommandItem
                            key={bank.id}
                            value={bank.name}
                            onSelect={() => {
                              setSelectedBank(bank);
                              setBankSearchOpen(false);
                              setAccountName("");
                              setIsVerified(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedBank?.id === bank.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            {bank.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Account Name */}
            <div className="space-y-2">
              <Label htmlFor="modalAccountName">Account Name</Label>
              <div className="relative">
                <Input
                  id="modalAccountName"
                  value={accountName}
                  readOnly
                  placeholder="Enter your account name"
                  className="bg-gray-50"
                />
                {isVerified && accountName && (
                  <Badge className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-green-100 text-green-700">
                    Verified
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
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
                    const value = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10);
                    setAccountNumber(value);
                  }}
                  placeholder="Enter your account number"
                  maxLength={10}
                />
                {isVerifying && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
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
                onClick={handleModalSave}
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

      {/* Confirm Payment Method Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
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
              onClick={handleCancelConfirm}
              className="flex-1 bg-transparent"
            >
              No, Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
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
    </div>
  );
}
