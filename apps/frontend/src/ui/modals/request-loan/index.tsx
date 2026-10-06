import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  RequestModalContent,
  RequestModalContentConfirmation,
  RequestModalContentHeader,
  RequestModalContentSuccess,
} from "./content";
import RequestModalContentFooter from "./mutation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { userLoanOverview } from "@/lib/queries/user/loan";

/**
 * "New Loan Request", or "Top-up Request" while a loan is running (the API turns a request into a top-up on it).
 * Disabled while a loan, top-up or asset request is still being decided or paid out.
 */
export default function RequestLoanModal() {
  const { data: overview, isLoading } = useQuery(userLoanOverview);
  const o = overview?.data;
  const topup = (o?.disbursedCount ?? 0) > 0;
  const waiting = o
    ? o.pendingLoans.length > 0 || o.pendingTopups.length > 0 || o.commoditiesInReview.length > 0
    : false;
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
      {waiting || isLoading ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* A disabled button swallows pointer events; the span keeps its tooltip reachable. */}
            <span tabIndex={0}>
              <Button size="sm" disabled>
                {topup ? "Top-up Request" : "New Loan Request"}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isLoading
              ? "Checking your loans…"
              : topup
                ? "You can ask for a top-up once your current request is decided and paid out"
                : "You can ask for another loan once your current request is decided and paid out"}
          </TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm">{topup ? "Top-up Request" : "New Loan Request"}</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{topup ? "Top-up Application" : "Loan Application"}</DialogTitle>
        </DialogHeader>
        <Separator className="bg-border" />
        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          {step <= 2 ? <RequestModalContentHeader step={step} topup={topup} /> : null}
          {step === 1 ? (
            <RequestModalContent
              amount={loanAmount}
              setAmount={setLoanAmount}
              commodity={commodity}
              setCommodity={setCommodity}
              category={category}
              setCategory={setCategory}
              topup={topup}
            />
          ) : step === 2 ? (
            <RequestModalContentConfirmation
              checked={checked}
              setChecked={setChecked}
              amount={loanAmount}
              category={category}
              commodity={commodity}
              topup={topup}
            />
          ) : (
            <RequestModalContentSuccess topup={topup} />
          )}
          <Separator className="bg-border" />
        </section>
        <RequestModalContentFooter
          step={step}
          checked={checked}
          amount={loanAmount}
          commodity={commodity}
          category={category}
          setStep={setStep}
          closeModal={() => setIsOpen(false)}
          topup={topup}
        />
      </DialogContent>
    </Dialog>
  );
}
