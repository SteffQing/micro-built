import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  RequestModalContent,
  RequestModalContentConfirmation,
  RequestModalContentHeader,
  RequestModalContentSuccess,
} from "./content";
import RequestModalContentFooter from "./mutation";

export default function RequestLoanModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [commodity, setCommodity] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [checked, setChecked] = useState<boolean>(false);
  const [category, setCategory] = useState<LoanCategory | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setCommodity("");
      setLoanAmount(0);
      setChecked(false);
      setCategory(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New Loan Request</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Loan Application</DialogTitle>
        </DialogHeader>
        <Separator className="bg-[#F0F0F0]" />
        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          {step <= 2 ? <RequestModalContentHeader step={step} /> : null}
          {step === 1 ? (
            <RequestModalContent
              amount={loanAmount}
              setAmount={setLoanAmount}
              commodity={commodity}
              setCommodity={setCommodity}
              category={category}
              setCategory={setCategory}
            />
          ) : step === 2 ? (
            <RequestModalContentConfirmation checked={checked} setChecked={setChecked} />
          ) : (
            <RequestModalContentSuccess />
          )}
          <Separator className="bg-[#F0F0F0]" />
        </section>
        <RequestModalContentFooter
          step={step}
          checked={checked}
          amount={loanAmount}
          commodity={commodity}
          category={category}
          setStep={setStep}
          closeModal={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
