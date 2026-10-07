import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";

export const base = "/admin/organizations";

/** Every organization A–Z, with where its variations stand. Also the customer filter's options (label `name`, value `id`). */
export const organizationsList = queryOptions({
  queryKey: [base],
  queryFn: async () => {
    const res = await api.get<ApiRes<OrganizationDto[]>>(base);
    return res.data;
  },
  staleTime: 60 * 1000,
});
