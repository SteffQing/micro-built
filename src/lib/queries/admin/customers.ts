import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/admin/customers/";

export const customersOverview = queryOptions({
  queryKey: [base, "overview"],
  queryFn: async () => {
    const res = await api.get<ApiRes<CustomersOverviewDto>>(base + "overview");
    return res.data;
  },
  staleTime: 20 * 60 * 1000,
});

export const customersList = (params: CustomersQuery = {}) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const searchParams = setParams(params);
      const res = await api.get<ApiRes<CustomerListItemDto[]>>(
        base + searchParams
      );

      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

export const getOrganizations = queryOptions({
  queryKey: [base, "organizations"],
  queryFn: async () => {
    const res = await api.get<ApiRes<OrganizationListItemDto[]>>(
      base + "organizations"
    );
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});
