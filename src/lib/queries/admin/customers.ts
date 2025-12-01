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
				base + searchParams,
			);

			return res.data;
		},
		staleTime: 5 * 60 * 1000,
	});

export const accountOfficerCustomersList = (
	params: AccountOfficerCustomersQuery,
) => {
	const { officer_id, ...queryParams } = params;

	console.log({ markettteerrrrId: officer_id });

	return queryOptions({
		queryKey: [base, "account-officers", officer_id, queryParams],
		queryFn: async () => {
			const searchParams = setParams(queryParams);
			const res = await api.get<ApiRes<CustomerListItemDto[]>>(
				`${base}account-officers/${officer_id}${searchParams}`,
			);

			return res.data;
		},
		staleTime: 5 * 60 * 1000,
	});
};

export const myCustomersList = (params: CustomersQuery = {}) =>
	queryOptions({
		queryKey: [base, "account_officer/me", params],
		queryFn: async () => {
			const searchParams = setParams(params);
			const res = await api.get<ApiRes<CustomerListItemDto[]>>(
				base + "account_officer/me" + searchParams,
			);

			return res.data;
		},
		staleTime: 5 * 60 * 1000,
	});
