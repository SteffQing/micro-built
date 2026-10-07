import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

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

/** One organization, as in the list. */
export const organizationDetail = (id: string) =>
  queryOptions({
    queryKey: [base, id],
    queryFn: async () => {
      const res = await api.get<ApiRes<OrganizationDto>>(`${base}/${id}`);
      return res.data;
    },
    staleTime: 60 * 1000,
  });

/** Its customers by status and their loans' figures (the same shape as an account officer's stats). */
export const organizationStats = (id: string) =>
  queryOptions({
    queryKey: [base, id, "stats"],
    queryFn: async () => {
      const res = await api.get<ApiRes<AccountOfficerStatsDto>>(`${base}/${id}/stats`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

/** Its customers: the customers list filtered to the organization. */
export const organizationCustomersList = (id: string, params: AccountOfficerCustomersQuery) =>
  queryOptions({
    queryKey: [base, id, "customers", params],
    queryFn: async () => {
      const searchParams = setParams({ ...params, organizationId: id });
      const res = await api.get<ApiRes<CustomerListItemDto[]>>(`/admin/customers/${searchParams}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
