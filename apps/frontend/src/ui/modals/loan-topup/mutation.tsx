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
import { loanTopup } from "@/lib/mutations/admin/customer";

interface Props
  extends RequestModalContentHeaderProps,
    Omit<RequestModalContentConfirmationProps, "setChecked">,
    Omit<
      RequestModalContentProps,
      "setAmount" | "setCommodity" | "setCategory" | "setTenure"
    > {
  setStep: Dispatch<SetStateAction<number>>;
  closeModal: () => void;
  userId: string;
}
function RequestModalContentFooter({
  step,
  checked,
  amount,
  commodity,
  category,
  setStep,
  closeModal,
  userId,
  tenure,
}: Props) {
  return (
    <DialogFooter>
      {step === 1 ? (
        <SetDetails
          setStep={setStep}
          amount={amount}
          commodity={commodity}
          category={category}
          tenure={tenure}
        />
      ) : step === 2 ? (
        <Confirmation
          setStep={setStep}
          amount={amount}
          commodity={commodity}
          checked={checked}
          category={category}
          userId={userId}
          tenure={tenure}
        />
      ) : (
        <Success closeModal={closeModal} />
      )}
    </DialogFooter>
  );
}

type SetDetailsProps = Pick<
  Props,
  "setStep" | "amount" | "commodity" | "category" | "tenure"
>;
function SetDetails({
  setStep,
  amount,
  commodity,
  category,
  tenure,
}: SetDetailsProps) {
  const hasValidDetails =
    category === "ASSET_PURCHASE"
      ? commodity.trim().length > 0
      : category !== null && amount >= 1_000 && tenure >= 1 && tenure <= 120;

  return (
    <Button
      className={cn(
        "w-full rounded-[8px] p-2.5 font-medium text-sm",
        "btn-gradient text-primary-foreground"
      )}
      disabled={!hasValidDetails}
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
  userId,
  tenure,
}: Omit<Props, "step" | "closeModal">) {
  const { isPending, mutateAsync } = useMutation(loanTopup(userId));

  async function requestLoan() {
    if (isPending) return;
    await mutateAsync({
      category: category!,
      ...(category === "ASSET_PURCHASE"
        ? { commodityLoan: { assetName: commodity } }
        : { cashLoan: { amount, tenure } }),
    });

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
