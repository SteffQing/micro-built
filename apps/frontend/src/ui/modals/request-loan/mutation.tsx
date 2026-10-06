import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type {
  RequestModalContentHeaderProps,
  RequestModalContentConfirmationProps,
  RequestModalContentProps,
} from "./content";
import type { Dispatch, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import {
  requestCashLoan,
  requestCommodityLoan,
} from "@/lib/mutations/user/loans";

interface Props
  extends RequestModalContentHeaderProps,
    Omit<RequestModalContentConfirmationProps, "setChecked">,
    Omit<
      RequestModalContentProps,
      "setAmount" | "setCommodity" | "setCategory"
    > {
  setStep: Dispatch<SetStateAction<number>>;
  closeModal: () => void;
}
function RequestModalContentFooter({
  step,
  checked,
  amount,
  commodity,
  category,
  setStep,
  closeModal,
  topup,
}: Props) {
  return (
    <DialogFooter>
      {step === 1 ? (
        <SetDetails setStep={setStep} amount={amount} commodity={commodity} category={category} topup={topup} />
      ) : step === 2 ? (
        <Confirmation
          setStep={setStep}
          amount={amount}
          commodity={commodity}
          checked={checked}
          category={category}
        />
      ) : (
        <Success closeModal={closeModal} />
      )}
    </DialogFooter>
  );
}

type SetDetailsProps = Pick<Props, "setStep" | "amount" | "commodity" | "category" | "topup">;
function SetDetails({ setStep, amount, commodity, category, topup }: SetDetailsProps) {
  // A new loan needs its type; a top-up takes the running loan's.
  const ready =
    category === "ASSET_PURCHASE" ? commodity.trim() !== "" : amount >= 1000 && (topup || category !== null);
  return (
    <Button
      className={cn(
        "w-full rounded-[8px] p-2.5 font-medium text-sm",
        "btn-gradient text-primary-foreground"
      )}
      disabled={!ready}
      onClick={() => setStep(2)}
    >
      Continue
    </Button>
  );
}

function Confirmation({
  setStep,
  amount,
  commodity,
  checked,
  category,
}: Omit<Props, "step" | "closeModal">) {
  const cashLoan = useMutation(requestCashLoan);
  const commodityLoan = useMutation(requestCommodityLoan);
  const isPending = cashLoan.isPending || commodityLoan.isPending;

  async function requestLoan() {
    if (isPending) return;
    if (category === "ASSET_PURCHASE") {
      await commodityLoan.mutateAsync({
        assetName: commodity,
      });
    } else {
      await cashLoan.mutateAsync({ amount, ...(category ? { category } : {}) });
    }
    setStep(3);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setStep(1)}
        disabled={isPending}
        className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
      >
        Back
      </Button>
      <Button
        className="rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm flex-1 btn-gradient"
        onClick={requestLoan}
        disabled={!checked || isPending}
        loading={isPending}
      >
        Confirm
      </Button>
    </>
  );
}

function Success({ closeModal }: Pick<Props, "closeModal">) {
  return (
    <Button
      className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
      onClick={closeModal}
    >
      Close
    </Button>
  );
}

export default RequestModalContentFooter;
