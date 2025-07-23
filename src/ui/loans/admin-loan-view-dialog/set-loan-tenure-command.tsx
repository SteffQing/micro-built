import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { useState } from "react";
import { toast } from "sonner";

export const AdminSetloanTermsCommand = ({
  loan,
  onClose,
}: {
  loan: CashLoanItemDto;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [tenure, setTenure] = useState("");
  const { mutateAsync, isPending, isSuccess, error, isError } = useMutation({
    mutationFn: async () => {
      const res = await api.patch<{
        message: string;
      }>(`/admin/loans/cash/${loan.id}/terms`, { tenure: Number(tenure) });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["all_cashloans"],
      });
      toast.success("Loan terms have been successfully set.");
    },
  });

  const handleSubmit = () => {
    mutateAsync();
  };
  return (
    <div className="w-full space-y-6">
      <Separator />

      {isSuccess && (
        <div className="flex items-center justify-center min-h-30 w-full gap-2">
          <div className=" flex flex-col items-center gap-2">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <p className="text-primary text-sm">
              Loan terms have been successfully set.
            </p>
          </div>
        </div>
      )}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="w-3 h-4" />
          <AlertDescription>
            {(error instanceof AxiosError && error.response?.data.message) ||
              "Failed to set loan terms"}
          </AlertDescription>
        </Alert>
      )}
      {!isSuccess && (
        <div className="w-full space-y-3">
          <div>
            <Input
              type="number"
              value={tenure}
              onChange={(e) => setTenure(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 w-full gap-2">
            <Button variant="outline" disabled={isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Confirming
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
