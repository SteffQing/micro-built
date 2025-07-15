"use client";

import { useState } from "react";
import { usePaymentMethod } from "./use-payment-method";
import { PaymentMethodLoading } from "./payment-method-loading";
import { PaymentMethodEmpty } from "./payment-method-empty";
import { PaymentMethodDisplay } from "./payment-method-display";
import { EditPaymentMethodModal } from "./edit-payment-method-dialog";
import { ConfirmPaymentMethodModal } from "./confirm-payment-method-dialog";
import { PaymentMethodData } from "./types";

export function PaymentMethod() {
  const {
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
  } = usePaymentMethod();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChanges, setPendingChanges] =
    useState<PaymentMethodData | null>(null);

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

  const handleBankSelect = (bank: typeof selectedBank) => {
    setSelectedBank(bank);
    setAccountName("");
    // setIsVerified(false);
  };

  if (isLoading) {
    return <PaymentMethodLoading />;
  }

  if (!paymentMethod && !isEditMode) {
    return <PaymentMethodEmpty onAddClick={() => setIsEditMode(true)} />;
  }

  return (
    <>
      {paymentMethod && (
        <PaymentMethodDisplay
          paymentMethod={paymentMethod}
          onEdit={handleEdit}
        />
      )}

      <EditPaymentMethodModal
        isOpen={showEditModal}
        onOpenChange={setShowEditModal}
        banks={banks}
        selectedBank={selectedBank}
        onBankSelect={handleBankSelect}
        bankSearchOpen={bankSearchOpen}
        setBankSearchOpen={setBankSearchOpen}
        accountNumber={accountNumber}
        setAccountNumber={setAccountNumber}
        accountName={accountName}
        isVerifying={isVerifying}
        isVerified={isVerified}
        isSaving={isSaving}
        error={error}
        onSave={handleModalSave}
      />

      <ConfirmPaymentMethodModal
        isOpen={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        onConfirm={handleConfirmSave}
        onCancel={handleCancelConfirm}
        isSaving={isSaving}
      />
    </>
  );
}
