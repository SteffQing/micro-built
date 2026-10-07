import { api } from "@/lib/axios";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";

export const calloutsBase = "/callouts";
export const adminCalloutsBase = "/admin/callouts";

/** The signed-in user's callouts, leaving out the ones dismissed in this browser (the next ones fill in). */
export const myCallouts = (dismissed: string[]) =>
  queryOptions({
    queryKey: [calloutsBase, dismissed],
    queryFn: async () => {
      const res = await api.get<ApiRes<ViewerCallout[]>>(calloutsBase, {
        params: dismissed.length ? { exclude: dismissed.join(",") } : undefined,
      });
      return res.data.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
    // While the list without a just-dismissed callout loads, keep showing the rest.
    placeholderData: keepPreviousData,
  });

/** SUPER_ADMIN: every callout. */
export const allCallouts = queryOptions({
  queryKey: [adminCalloutsBase],
  queryFn: async () => {
    const res = await api.get<ApiRes<Callout[]>>(adminCalloutsBase);
    return res.data.data ?? [];
  },
});
