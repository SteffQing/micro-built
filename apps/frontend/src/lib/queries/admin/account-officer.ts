import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/admin/account-officer/";

export const myCustomersList = (params: CustomersQuery = {}) =>
  queryOptions({
    queryKey: [base, "me", params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CustomerListItemDto[]>>(
        base + "me" + searchParams
      );

      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const accountOfficerCustomersList = (
  id: string,
  params: AccountOfficerCustomersQuery
) => {
  return queryOptions({
    queryKey: [base, id, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CustomerListItemDto[]>>(
        `${base}${id}/customers${searchParams}`
      );

      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const accountOfficers = queryOptions({
  queryKey: [base],
  queryFn: async () => {
    const res = await api.get<ApiRes<AccountOfficerDto[]>>(base);
    return res.data;
  },
  staleTime: 10 * 60 * 1000,
});

export const accountOfficerStats = (officerId: string) =>
  queryOptions({
    queryKey: [base, officerId, "stats"],
    queryFn: async () => {
      const res = await api.get<ApiRes<AccountOfficerStatsDto>>(
        `${base}${officerId}/stats`
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
