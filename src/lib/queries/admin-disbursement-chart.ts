import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";


export interface AdminDisbursementData {
  month: string;
  EDUCATION: number;
  PERSONAL: number;
  BUSINESS: number;
  MEDICAL: number;
  RENT: number;
  TRAVEL: number;
  AGRICULTURE: number;
  UTILITIES: number;
  EMERGENCY: number;
  OTHERS: number;
  ASSET_PURCHASE: number;
}

export interface AdminOverview {
  message: string;
  data: AdminDisbursementData[];
}

export interface LoanDisbursementParam {
  year?: string;
}
// export const adminDDisbursementChartOption(params: LoanDisbursementParam = {}) = queryOptions({
//   queryKey: ["admin-disbursement-chart"],
//    queryFn: async () => {
//       const searchParams = new URLSearchParams();
//       if (params.year) searchParams.set("year", params.year);

//       const url = `/admin/dashboard/disbursement-chart${
//         searchParams.toString() ? `?${searchParams.toString()}` : ""
//       }`;

//       return (await api.get<AdminOverview>(url)).data;
//     },
//   staleTime: 20 * 60 * 1000,
// });

export const adminDisbursementChartOption = (
  params: LoanDisbursementParam = {}
) =>
  queryOptions({
    queryKey: ["admin-disbursement-chart", params.year],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.year) searchParams.set("year", params.year);

      const url = `/admin/dashboard/disbursement-chart${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

      return (await api.get<AdminOverview>(url)).data;
    },
    staleTime: 20 * 60 * 1000,
  });
