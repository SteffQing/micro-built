"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumericalInput } from "@/components/ui/numerical-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LoanIcons } from "@/components/svg/loan";
import { api } from "@/lib/axios";
import { loanTopup } from "@/lib/mutations/admin/customer";
import { cashLoanQuery } from "@/lib/queries/admin/cash-loans";
import { getUserActiveLoan } from "@/lib/queries/admin/customer";
import { marketerLoan } from "@/lib/queries/marketer";
import { formatCurrency } from "@/lib/utils";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { useUserProvider } from "@/store/auth";
import { MonthsStepper, RepriceCheckbox } from "@/ui/topups/topup-actions";
import { CashInput, CommodityDropdown } from "../request-loan/dropdown-input";

type Kind = "CASH" | "ASSET";

interface Props {
  userId: string;
  trigger?: ReactNode;
}

function errorText(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(". ") : (message ?? fallback);
  }
  return error instanceof Error ? error.message : fallback;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium wrap-anywhere">{children}</dd>
    </div>
  );
}

const months = (count: number) => (count > 0 ? `+${count} month${count === 1 ? "" : "s"}` : "None");

/**
 * An admin's top-up on the customer's running loan, which keeps its loan type: cash (an amount, and months to add
 * if needed) or an asset. An asset top-up from an admin is priced and approved in the same step (the asset price,
 * what the customer sees, internal notes, months to add); a marketer's waits for review on Asset Loans.
 */
export default function LoanTopupModal({ userId, trigger }: Props) {
  const { userRole } = useUserProvider();
  // Marketers request; approving an asset needs an admin.
  const canApprove = userRole === "ADMIN" || userRole === "SUPER_ADMIN";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"details" | "confirm" | "done">("details");
  const [kind, setKind] = useState<Kind>("CASH");
  const [amount, setAmount] = useState(0);
  const [commodity, setCommodity] = useState("");
  const [monthsDelta, setMonthsDelta] = useState(0);
  const [reprice, setReprice] = useState(false);
  const [publicDetails, setPublicDetails] = useState("");
  const [privateDetails, setPrivateDetails] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  // A top-up is charged its running loan's rates, snapshotted when that loan was approved.
  const { data: active } = useQuery({ ...getUserActiveLoan(userId), enabled: open });
  const runningId = active?.data?.id;
  // A marketer reads it through their own (customers-only) route.
  const { data: running } = useQuery({
    ...(canApprove ? cashLoanQuery : marketerLoan)(runningId ?? ""),
    enabled: open && !!runningId,
  });
  const loan = running?.data;

  const request = useMutation(loanTopup(userId));
  const approval = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AcceptCommodityLoan }) =>
      (await api.patch<ApiRes<CommodityLoanDto>>(`/admin/loans/commodity/${id}/approve`, data)).data,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/admin/loans/commodity/"] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/loans/topups"] }),
      ]),
  });
  const busy = request.isPending || approval.isPending;

  const approveAsset = kind === "ASSET" && canApprove;
  const detailsReady =
    kind === "CASH"
      ? amount >= 1_000
      : commodity.trim().length > 0 &&
        (!approveAsset || (amount >= 1_000 && publicDetails.trim().length > 0 && privateDetails.trim().length > 0));

  function reset() {
    setStep("details");
    setKind("CASH");
    setAmount(0);
    setCommodity("");
    setMonthsDelta(0);
    setReprice(false);
    setPublicDetails("");
    setPrivateDetails("");
    setAgreed(false);
    setError("");
    setDoneMessage("");
  }

  function changeKind(next: Kind) {
    setKind(next);
    setAmount(0);
    setCommodity("");
    setMonthsDelta(0);
    setReprice(false);
  }

  async function submit() {
    setError("");
    try {
      if (kind === "CASH") {
        const res = await request.mutateAsync({
          kind: "CASH",
          cashLoan: { amount },
          ...(monthsDelta > 0 && { monthsDelta }),
        });
        setDoneMessage(res.message ?? "Top-up requested. It is waiting for approval on Top-ups.");
        setStep("done");
        return;
      }
      const res = await request.mutateAsync({ kind: "ASSET", commodityLoan: { assetName: commodity } });
      const requestId = res.data?.commodityLoanId;
      if (!approveAsset || !requestId) {
        setDoneMessage(res.message ?? "Asset top-up requested. It is waiting for review on Asset Loans.");
        setStep("done");
        return;
      }
      try {
        await approval.mutateAsync({
          id: requestId,
          data: {
            amount,
            publicDetails: publicDetails.trim(),
            privateDetails: privateDetails.trim(),
            ...(monthsDelta > 0 && { monthsDelta, reprice }),
          },
        });
        setDoneMessage(`The ${commodity} top-up is approved. A super admin disburses it from Top-ups or Asset Loans.`);
      } catch (err) {
        // The request exists; only its approval failed. Say so rather than inviting a second request.
        setDoneMessage(
          `The ${commodity} top-up was requested, but approving it failed: ${errorText(err, "unknown error")}. ` +
            "Approve it on Asset Loans.",
        );
      }
      setStep("done");
    } catch (err) {
      setError(errorText(err, "The top-up could not be requested"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="w-full gap-2">
            Top-up Loan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "done" ? "Top-up Submitted" : "Top-up Loan"}</DialogTitle>
          {step !== "done" && (
            <DialogDescription>
              {loan
                ? `On loan ${loan.id} (${loan.category.replace(/_/g, " ").toLowerCase()}): it keeps its loan type.`
                : "On the customer's running loan, which keeps its loan type."}
            </DialogDescription>
          )}
        </DialogHeader>
        <Separator className="bg-border" />

        {step === "details" && (
          <section className="grid gap-4 p-4 sm:p-5">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Top-up Type</Label>
              <Select value={kind} onValueChange={(value) => changeKind(value as Kind)}>
                <SelectTrigger className="w-full" aria-label="Top-up type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="ASSET">Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {kind === "CASH" ? (
              <CashInput amount={amount} setAmount={setAmount} />
            ) : (
              <CommodityDropdown commodity={commodity} setCommodity={setCommodity} />
            )}

            {approveAsset && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="asset-price" className="text-sm font-medium">
                    Asset price <span className="font-normal text-muted-foreground">(the top-up amount)</span>
                  </Label>
                  <NumericalInput
                    id="asset-price"
                    value={amount}
                    onValueChange={(value) => setAmount(value || 0)}
                    emptyOnZero
                    maxDecimals={2}
                    aria-label="Asset price"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-public" className="text-sm font-medium">
                    Details for the customer
                  </Label>
                  <Textarea
                    id="asset-public"
                    value={publicDetails}
                    onChange={(e) => setPublicDetails(e.target.value)}
                    placeholder="e.g. HP EliteBook 840 G8, delivered to your office within 7 days"
                    className="min-h-[70px] resize-none"
                    maxLength={500}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="asset-private" className="text-sm font-medium">
                    Internal notes <span className="font-normal text-muted-foreground">(admins only)</span>
                  </Label>
                  <Textarea
                    id="asset-private"
                    value={privateDetails}
                    onChange={(e) => setPrivateDetails(e.target.value)}
                    placeholder="Vendor, cost, market research"
                    className="min-h-[70px] resize-none"
                    maxLength={500}
                  />
                </div>
              </>
            )}

            {(kind === "CASH" || approveAsset) && (
              <div className="grid gap-2">
                <Label htmlFor="topup-months" className="text-sm font-medium">
                  Tenure change <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <MonthsStepper id="topup-months" value={monthsDelta} onChange={setMonthsDelta} />
                <p className="text-xs text-muted-foreground">
                  {loan
                    ? `The loan runs ${loan.tenure} months${monthsDelta > 0 ? `; ${loan.tenure + monthsDelta} with this change` : ""}. `
                    : ""}
                  Applied when the top-up is disbursed.
                </p>
                {approveAsset && (
                  <RepriceCheckbox id="topup-reprice" months={monthsDelta} checked={reprice} onChange={setReprice} />
                )}
              </div>
            )}

            {kind === "ASSET" && !canApprove && (
              <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                An admin prices and approves the asset on Asset Loans, with any tenure change.
              </p>
            )}
          </section>
        )}

        {step === "confirm" && (
          <section className="grid gap-4 p-4 sm:p-5">
            <dl className="grid gap-2 rounded-md border bg-muted p-3">
              <Row label="Type">{kind === "CASH" ? "Cash" : "Asset"}</Row>
              {kind === "ASSET" && <Row label="Asset">{commodity}</Row>}
              {(kind === "CASH" || approveAsset) && <Row label="Amount">{formatCurrency(amount)}</Row>}
              {(kind === "CASH" || approveAsset) && (
                <Row label="Tenure change">
                  {months(monthsDelta)}
                  {monthsDelta > 0 && reprice && approveAsset ? ", interest recalculated" : ""}
                </Row>
              )}
              <Row label="Interest (monthly)">{loan ? `${loan.interestRate}%` : "…"}</Row>
              <Row label="Management fee">{loan ? `${loan.managementFeeRate}%` : "…"}</Row>
            </dl>
            <p className="text-xs text-muted-foreground">
              {kind === "CASH"
                ? "Charged at the running loan's rates. It waits for approval on Top-ups."
                : approveAsset
                  ? "Charged at the running loan's rates. It is requested and approved now; a super admin disburses it."
                  : "It waits for an admin to price and approve it on Asset Loans."}
            </p>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="topup-agree"
                className="mt-0.5"
                checked={agreed}
                onCheckedChange={(next) => setAgreed(next === true)}
              />
              <Label htmlFor="topup-agree" className="text-sm leading-snug font-normal text-muted-foreground">
                The details above are correct.
              </Label>
            </div>
            {error && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </section>
        )}

        {step === "done" && (
          <section className="grid gap-3 p-4 text-center sm:p-5">
            <div className="flex justify-center">
              <LoanIcons.successful_application />
            </div>
            <p className="text-sm text-muted-foreground">{doneMessage}</p>
          </section>
        )}

        <DialogFooter>
          {step === "details" && (
            <Button className="btn-gradient sm:flex-1" disabled={!detailsReady} onClick={() => setStep("confirm")}>
              Continue
            </Button>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" className="sm:flex-1" disabled={busy} onClick={() => setStep("details")}>
                Back
              </Button>
              <Button className="btn-gradient sm:flex-1" disabled={!agreed || busy} loading={busy} onClick={submit}>
                {approveAsset ? "Request and approve" : "Submit top-up"}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button variant="outline" className="sm:flex-1" onClick={() => setOpen(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
