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
    onSuccess: (data) => {
      forget(organizationId);
      toast.success(data.message);
    },
  });

const refreshOrganizations = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: [base] }),
    queryClient.invalidateQueries({ queryKey: [variationBase] }),
    queryClient.invalidateQueries({ queryKey: [customersBase] }),
  ]);

/**
 * After a merge or delete the organization is gone: its own queries are dropped instead of refetched (they'd only
 * 404), and the rest refresh in the background so the caller can redirect at once instead of waiting on them.
 */
function forget(organizationId: string) {
  void queryClient.cancelQueries({ queryKey: [base, organizationId] });
  queryClient.removeQueries({ queryKey: [base, organizationId] });
  void refreshOrganizations();
}

/** Any admin: a new organization, before any customer is in it. 409 when the name (ignoring case) is taken. */
export const createOrganization = mutationOptions({
  mutationKey: [base, "create"],
  mutationFn: async (name: string) => {
    const res = await api.post<ApiRes<OrganizationDto>>(base, { name });
    return res.data;
  },
  onSuccess: (data) => refreshOrganizations().then(() => toast.success(data.message)),
});

/** SUPER_ADMIN (confirmed once per ten minutes): corrects an organization's spelling. */
export const renameOrganization = (organizationId: string) =>
  mutationOptions({
    mutationKey: [base, organizationId, "rename"],
    mutationFn: async (name: string) => {
      const res = await api.patch<ApiRes<OrganizationDto>>(`${base}/${organizationId}`, { name });
      return res.data;
    },
    onSuccess: (data) => refreshOrganizations().then(() => toast.success(data.message)),
  });

/** SUPER_ADMIN (confirmed once per ten minutes): accepts an organization an admin or marketer named. */
export const approveOrganization = (organizationId: string) =>
  mutationOptions({
    mutationKey: [base, organizationId, "approve"],
    mutationFn: async () => {
      const res = await api.post<ApiRes<OrganizationDto>>(`${base}/${organizationId}/approve`);
      return res.data;
    },
    onSuccess: (data) => refreshOrganizations().then(() => toast.success(data.message)),
  });

/** SUPER_ADMIN (confirmed once per ten minutes): deletes an organization nothing uses yet. */
export const deleteOrganization = (organizationId: string) =>
  mutationOptions({
    mutationKey: [base, organizationId, "delete"],
    mutationFn: async () => {
      const res = await api.delete<ApiRes<null>>(`${base}/${organizationId}`);
      return res.data;
    },
    onSuccess: (data) => {
      forget(organizationId);
      toast.success(data.message);
    },
  });
