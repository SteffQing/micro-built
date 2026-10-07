"use client";

import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { revertVoucher } from "@/lib/mutations/admin/repayments";
import { markNoPayrollMutation, revertNoPayrollMutation } from "@/lib/mutations/admin/variations";
import { ReasonDialog } from "./reason-dialog";

type DialogControl = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Runs once the API has done it (before the dialog closes). */
  onDone?: () => unknown;
};

/**
 * Settles a month whose voucher never came: everyone in the variation is marked failed and charged. Asks why, then the
 * shared "Confirm it's you" prompt.
 */
export function NoPayrollDialog({
  variationId,
  label,
  confirmLabel,
  ...control
}: DialogControl & { variationId: string; label: string; confirmLabel?: string }) {
  const { mutateAsync } = useMutation(markNoPayrollMutation);
  return (
    <ReasonDialog
      {...control}
      title={`Mark ${label} as no payroll`}
      points={[
        "The voucher for this month never came, so nobody in the variation was paid by payroll.",
        "Every deduction in it is marked failed and the default charge is applied, as when a voucher comes in short.",
        "A late voucher can still be added: revert this first (until the next month gets its voucher), then upload it.",
      ]}
      label="What happened to the voucher?"
      placeholder="Payroll confirmed it did not run deductions for this month"
      confirmLabel={confirmLabel ?? "Mark as no payroll"}
      pendingLabel="Settling…"
      onConfirm={async (reason) => {
        await mutateAsync({ id: variationId, reason });
        await control.onDone?.();
      }}
    />
  );
}

/** Undoes a no payroll: the month waits for its voucher again and the charges it applied are removed. */
export function RevertNoPayrollDialog({
  variationId,
  label,
  ...control
}: DialogControl & { variationId: string; label: string }) {
  const { mutateAsync } = useMutation(revertNoPayrollMutation);
  return (
    <ReasonDialog
      {...control}
      title={`Revert no payroll for ${label}`}
      points={[
        "The month goes back to waiting for its voucher, and the charges the no payroll applied are removed.",
        "Only while the next month has no voucher. If the next month was already generated, its amounts need regenerating.",
        "Refused if a liquidation was accepted since, or a tenure change it proposed was decided.",
      ]}
      label="Why are you reverting it?"
      placeholder="The voucher turned up late"
      confirmLabel="Revert no payroll"
      pendingLabel="Reverting…"
      onConfirm={async (reason) => {
        await mutateAsync({ id: variationId, reason });
        await control.onDone?.();
      }}
    />
  );
}

/** Undoes a voucher while its month is still current and the next month has no variation. */
export function RevertVoucherDialog({
  voucherId,
  label,
  ...control
}: DialogControl & { voucherId: string; label: string }) {
  const { mutateAsync } = useMutation(revertVoucher);
  return (
    <ReasonDialog
      {...control}
      title={`Revert the ${label} voucher`}
      points={[
        "The voucher's rows, the repayments they made and the charges it applied are removed.",
        "Loans the voucher finished paying go back to active, and the month's deductions wait for a voucher again.",
        "Only while the month is current and the next month has no variation. Refused if a liquidation was accepted since.",
        "Payroll details the voucher updated (net pay, grade, step, command) are not undone.",
      ]}
      label="Why are you reverting it?"
      placeholder="Uploaded for the wrong organization"
      confirmLabel="Revert voucher"
      pendingLabel="Reverting…"
      onConfirm={async (reason) => {
        await mutateAsync({ id: voucherId, reason });
        await control.onDone?.();
      }}
    />
  );
}
