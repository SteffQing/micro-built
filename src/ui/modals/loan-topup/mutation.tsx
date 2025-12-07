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
        <SetDetails setStep={setStep} amount={amount} commodity={commodity} />
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

type SetDetailsProps = Pick<Props, "setStep" | "amount" | "commodity">;
function SetDetails({ setStep, amount, commodity }: SetDetailsProps) {
  return (
    <Button
      className={cn(
        "w-full bg-[#FAFAFA] rounded-[8px] p-2.5 text-white font-medium text-sm",
        "btn-gradient text-[#999999]"
      )}
      disabled={amount < 1000 && commodity === ""}
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
    const commodityLoan = { assetName: commodity };
    const cashLoan = { amount, tenure };
    await mutateAsync({
      category: category!,
      ...(category === "ASSET_PURCHASE" ? commodityLoan : cashLoan),
    });

    setStep(3);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setStep(1)}
        disabled={isPending}
        className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
      >
        Back
      </Button>
      <Button
        className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
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
      className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
      onClick={closeModal}
    >
      Close
    </Button>
  );
}

export default RequestModalContentFooter;
