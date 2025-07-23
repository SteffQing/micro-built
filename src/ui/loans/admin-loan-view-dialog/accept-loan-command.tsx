import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { AxiosError } from "axios";

//APPROVE  || DISBURSE

export const AcceptLoanCommand = ({
  loan,
}: {
  loan: CashLoanItemDto;
  isOpen: boolean;
}) => {
  const queryClient = useQueryClient();
  const {
    mutateAsync: approveMutation,
    isPending: approvePending,
    isSuccess: isApproveSuccess,
    isError: isApproveError,
    error: approveError,
    // reset: resetApprove,
  } = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/admin/loans/cash/${loan.id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["all_cashloans"],
      });
      toast.success("Loan accepted successfully");
    },
  });

  const {
    mutateAsync: disburseMutation,
    isPending: disbursePending,
    isSuccess: isDisburseSuccess,
    isError: isDisburseError,
    error: disburseError,
    // reset: resetDisburse,
  } = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/admin/loans/cash/${loan.id}/disburse`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["all_cashloans"],
      });
      toast.success("Loan Disbursed successfully");
    },
  });

  const isError = isApproveError || isDisburseError;
  const error = approveError || disburseError;
  const isSuccess = isApproveSuccess || isDisburseSuccess;

  return (
    <div className="space-y-6">
      <Separator />
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="w-3 h-4" />
          <AlertDescription>
            {(error instanceof AxiosError && error.response?.data.message) ||
              "Failed to accept loan"}
          </AlertDescription>
        </Alert>
      )}
      {isSuccess && (
        <div className="flex items-center justify-center min-h-30 w-full gap-2">
          <div className="flex items-center gap-2 flex-col">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <p className="text-primary text-sm">Loan accepted successfully</p>
          </div>
        </div>
      )}
      <div className="w-full gap-2">
        {isSuccess ? (
          <></>
        ) : (
          <>
            {loan.status === "ACCEPTED" ? (
              <Button
                size="sm"
                className="w-full"
                onClick={() => approveMutation()}
                disabled={approvePending}
              >
                {approvePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving loan
                  </>
                ) : (
                  "Approve Loan"
                )}
              </Button>
            ) : (
              loan.status === "APPROVED" && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => disburseMutation()}
                  disabled={disbursePending}
                >
                  {disbursePending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disbursing loan
                    </>
                  ) : (
                    "Disburse Loan"
                  )}
                </Button>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};
