import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoanRequest } from "./table-request-history";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCheck, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AxiosError } from "axios";

export function LoanDialog({ loan }: { loan: LoanRequest }) {
  const queryClient = useQueryClient();
  const [loanterm, setLoanTerm] = useState<"ACCEPTED" | "REJECTED" | "">("");
  const { mutateAsync, isPending, isSuccess, error, isError } = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/user/loan/${loan.id}`, {
        status: loanterm,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-loan-request-history"],
      });
      toast.success("Loan " + loanterm + " successfully");
    },
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">View</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Loan Details</DialogTitle>
        </DialogHeader>
        <Separator />
        {isError && (
          <Alert variant="destructive" className="text-red-500">
            <AlertCircle className="w-3 h-4" />
            <AlertDescription>
              {" "}
              {error instanceof AxiosError
                ? error.response?.data.message
                : "Something went wrong"}
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-5">
          <div className="bg-accent/60 rounded-xl p-4 space-y-3">
            <div className="flex gap-2 justify-between">
              <p className="text-sm text-muted-foreground">LoanId</p>
              <p className="text-sm">{loan.id}</p>
            </div>
            <div className="flex gap-2 justify-between">
              <p className="text-sm text-muted-foreground">Loan Amount</p>
              <p className="text-sm">{loan.amount}</p>
            </div>
            <div className="flex gap-2 justify-between">
              <p className="text-sm text-muted-foreground">Loan Type</p>
              <p className="text-sm">{loan.category}</p>
            </div>
            <div className="flex gap-2 justify-between">
              <p className="text-sm text-muted-foreground">Loan Status</p>
              <p className="text-sm">{loan.status}</p>
            </div>
            <div className="flex gap-2 justify-between">
              <p className="text-sm text-muted-foreground">Loan Date</p>
              <p className="text-sm">{formatDate(loan.date, "PPpp")}</p>
            </div>
          </div>

          {loan.status === "PENDING" && (
            <>
              <p className="text-sm font-semibold">Accept Loan Terms</p>
              {isSuccess ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      setLoanTerm("REJECTED");
                      mutateAsync();
                    }}
                  >
                    {isPending && loanterm === "REJECTED" ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        Rejecting...
                      </>
                    ) : (
                      "Reject"
                    )}
                  </Button>
                  <Button
                    disabled={isPending}
                    onClick={() => {
                      setLoanTerm("ACCEPTED");
                      mutateAsync();
                    }}
                  >
                    {isPending && loanterm === "ACCEPTED" ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      "Accept"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="min-h-40 w-full flex items-center justify-center">
                  <div className="flex gap-2 flex-col items-center">
                    <CheckCheck className="w-8 h-8 text-green-600" />
                    <p className="text-sm font-semibold">
                      Loan Terms{" "}
                      {loanterm === "ACCEPTED" ? "Accepted" : "Rejected"}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
