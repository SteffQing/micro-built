import { uploads } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base as liquidationBase } from "@/lib/queries/user/liquidation";

const base = "/user/repayments";

export const requestLiquidation = mutationOptions({
  mutationKey: [base, "liquidation"],
  mutationFn: async (data: { amount: number; proof: File }) => {
    const formData = new FormData();
    formData.append("amount", data.amount.toString());
    formData.append("proof", data.proof);
    const res = await uploads.post<ApiRes<{ id: string; amount: number; state: string; requestedAt: string }>>(
      `${base}/liquidation`,
      formData,
    );
    return res.data;
  },
  onSuccess: (data) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [liquidationBase, "liquidations"] }),
      queryClient.invalidateQueries({ queryKey: [liquidationBase, "liquidation-preview"] }),
      queryClient.invalidateQueries({ queryKey: ["/user/repayments/"] }),
      queryClient.invalidateQueries({ queryKey: ["/user/loan/"] }),
      queryClient.invalidateQueries({ queryKey: ["/user/", "overview"] }),
    ]).then(() => toast.success(data.message)),
});
