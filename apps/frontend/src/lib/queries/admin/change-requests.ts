import { api } from "@/lib/axios";
import { queryOptions } from "@tanstack/react-query";
import { setParams } from "../../utils";

const base = "/admin/change-requests";

export { base };

export const adminChangeRequests = (
  params: { status?: ChangeRequestStatus; kind?: ChangeRequestKind; userId?: string; page?: number; limit?: number } = {},
) =>
  queryOptions({
    queryKey: [base, params],
    queryFn: async () => {
      const res = await api.get<ApiRes<ChangeRequestDto[]>>(`${base}${setParams(params)}`);
      return res.data;
    },
    staleTime: 30 * 1000,
  });

export const adminAuditLog = (params: AuditQuery = {}) =>
  queryOptions({
    queryKey: ["/admin/audit", params],
    queryFn: async () => {
      const res = await api.get<ApiRes<AuditEntryDto[]>>(`/admin/audit${setParams(params)}`);
      return res.data;
    },
    staleTime: 30 * 1000,
  });
