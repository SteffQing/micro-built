import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";
import { z } from "zod";

const base = "/admin/customers/";

const customerCount = z.number().int().nonnegative();
const customersOverviewSchema = z.object({
  activeCustomersCount: customerCount,
  flaggedCustomersCount: customerCount,
  customersWithActiveLoansCount: customerCount,
  defaultedCount: customerCount,
  flaggedCount: customerCount,
  ontimeCount: customerCount,
});

export const customersOverview = queryOptions({
  queryKey: [base, "overview"],
  queryFn: async () => {
    const res = await api.get<ApiRes<CustomersOverviewDto>>(base + "overview");
    if (res.data.error) throw new Error(res.data.error);

    // Missing metrics are a response error, not a genuine count of zero.
    const result = customersOverviewSchema.safeParse(res.data.data);
    if (!result.success) {
      throw new Error("Customer metrics are unavailable. Please try again.");
    }

    return { ...res.data, data: result.data };
  },
  staleTime: 0,
  refetchOnWindowFocus: true,
  // Repayment uploads and period closure finish in background jobs. Poll while
  // the page is visible so an early refetch does not leave pre-job counts cached.
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  retry: 1,
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
