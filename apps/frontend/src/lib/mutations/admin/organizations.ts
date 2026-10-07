import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base } from "@/lib/queries/admin/organizations";
import { base as changeRequestsBase } from "@/lib/queries/admin/change-requests";
import { base as customersBase } from "@/lib/queries/admin/customers";
import { variationBase } from "@/lib/payroll/variations";

/**
 * Proposes moving these customers (by IPPIS / staff id) into the organization: one ORGANIZATION change request each,
 * which a super admin approves. Each id comes back with its own outcome.
 */
export const requestOrganizationSwitch = (organizationId: string) =>
  mutationOptions({
    mutationKey: [base, organizationId, "switch-requests"],
    mutationFn: async (externalIds: string[]) => {
      const res = await api.post<ApiRes<OrganizationSwitchResultDto>>(`${base}/${organizationId}/switch-requests`, {
        externalIds,
      });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [changeRequestsBase] }),
  });

/** SUPER_ADMIN, confirmed with a code or passkey: folds a duplicate spelling into another organization. */
export const mergeOrganization = (organizationId: string) =>
  mutationOptions({
    mutationKey: [base, organizationId, "merge"],
    mutationFn: async (intoId: string) => {
      const res = await api.post<ApiRes<{ intoId: string; movedPayrolls: number }>>(`${base}/${organizationId}/merge`, {
        intoId,
      });
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [base] }),
        queryClient.invalidateQueries({ queryKey: [variationBase] }),
        queryClient.invalidateQueries({ queryKey: [customersBase] }),
      ]).then(() => toast.success(data.message)),
  });
