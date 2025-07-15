// hooks/usePaymentMethod.ts
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Bank, PaymentMethodData } from "./types";
import { api } from "@/lib/axios";
import axios from "axios";

export const usePaymentMethod = () => {
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

  const fetchPaymentMethod = async () => {
    try {
      const response = await api.get("/api/user/payment-method");
      if (response.data) {
        const data = response.data;
        setPaymentMethod(data);
        const bank = banks.find((b) => b.name === data.bankName);
        if (bank) {
          setSelectedBank(bank);
        }
        setAccountNumber(data.accountNumber);
        setAccountName(data.accountName);
        setIsVerified(true);
      } else if (response.status === 404) {
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
      const response = await axios.get("https://api.paystack.co/bank");
      const data = await response.data;
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

  const verifyAccount = useCallback(async () => {
    if (!selectedBank || accountNumber.length !== 10) return;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${selectedBank.code}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY}`,
          },
        }
      );

      const data = await response.data;

      if (data.status && data.data) {
        setAccountName(data.data.account_name);
        setIsVerified(true);
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
  }, [selectedBank, accountNumber, paymentMethod]);

  const savePaymentMethod = useCallback(
    async (data: PaymentMethodData) => {
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
          error instanceof Error
            ? error.message
            : "Failed to save payment method"
        );
        toast.error("Error", {
          description: "Failed to save payment method",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [paymentMethod]
  );

  // Auto-verify account when account number and bank are set
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
  }, [verifyAccount, accountNumber, selectedBank]);

  // Fetch data on mount
  useEffect(() => {
    fetchPaymentMethod();
    fetchBanks();
  }, []);

  return {
    paymentMethod,
    banks,
    selectedBank,
    setSelectedBank,
    accountNumber,
    setAccountNumber,
    accountName,
    setAccountName,
    isEditMode,
    setIsEditMode,
    isLoading,
    isVerifying,
    isSaving,
    isVerified,
    bankSearchOpen,
    setBankSearchOpen,
    error,
    setError,
    savePaymentMethod,
    fetchPaymentMethod,
    fetchBanks,
    verifyAccount,
  };
};
