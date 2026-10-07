import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { marketerBase } from "@/lib/queries/marketer";

/** Asks one admin (or everyone who can act on it now) to look at a loan, asset request or top-up. */
export const escalate = mutationOptions({
  mutationKey: [marketerBase, "escalations"],
  mutationFn: async (input: EscalateInput) =>
    (await api.post<ApiRes<EscalationResultDto>>(`${marketerBase}escalations`, input)).data,
  onSuccess: (data) => {
    const skipped = data.data?.skipped ?? [];
    toast.success(
      skipped.length > 0 ? `${data.message} (${skipped.join(", ")} asked in the last day: skipped)` : data.message,
    );
    // Every list shows when each item was last escalated.
    return queryClient.invalidateQueries({ queryKey: [marketerBase] });
  },
});
