import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {  Eye } from "lucide-react";
import { AdminSetloanTermsCommand } from "./set-loan-tenure-command";
import { AcceptLoanCommand } from "./accept-loan-command";
import { useState } from "react";
import { LoanDetails } from "./loan-details";

export function AdminLoanViewDialog({ loan }: { loan: CashLoanItemDto }) {
  const [isOpen, setisOpen] = useState(false);
  const handleOpen = (val: boolean) => {
    setisOpen(val);
  };
  const renderAdminCommands = () => {
    switch (loan.status) {
      case "PENDING":
        return (
          <AdminSetloanTermsCommand
            loan={loan}
            onClose={() => setisOpen(false)}
          />
        );
      case "APPROVED":
        return <AcceptLoanCommand loan={loan} isOpen={isOpen} />;
      case "REJECTED":
        return (
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="text-xs w-full">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        );
      case "ACCEPTED":
        return <AcceptLoanCommand loan={loan} isOpen={isOpen} />;
      default:
        return (
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="text-xs w-full">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <form>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs">
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
          </DialogHeader>
          <LoanDetails loan={loan} />
          {renderAdminCommands()}
        </DialogContent>
      </form>
    </Dialog>
  );
}
