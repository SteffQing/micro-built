import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminCalloutsBase, calloutsBase } from "@/lib/queries/callouts";

// The management list and the signed-in super admin's own sidebar both change.
const refresh = (message: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: [adminCalloutsBase] }),
    queryClient.invalidateQueries({ queryKey: [calloutsBase] }),
  ]).then(() => toast.success(message));

export const createCallout = mutationOptions({
  mutationKey: [adminCalloutsBase, "create"],
  mutationFn: async (input: CalloutInput) => (await api.post<ApiRes<Callout>>(adminCalloutsBase, input)).data,
  onSuccess: (data) => refresh(data.message),
});

/** Edit, publish or unpublish, pin or unpin, or renew (`renew: true` starts its 7 days again). */
export const updateCallout = mutationOptions({
  mutationKey: [adminCalloutsBase, "update"],
  mutationFn: async ({ id, ...input }: Partial<CalloutInput> & { id: string; renew?: boolean }) =>
    (await api.patch<ApiRes<Callout>>(`${adminCalloutsBase}/${id}`, input)).data,
  onSuccess: (data) => refresh(data.message),
});

export const deleteCallout = mutationOptions({
  mutationKey: [adminCalloutsBase, "delete"],
  mutationFn: async (id: string) => (await api.delete<ApiRes<Callout>>(`${adminCalloutsBase}/${id}`)).data,
  onSuccess: (data) => refresh(data.message),
});
