import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import {
  generateVariations,
  markNoPayroll,
  revertNoPayroll,
  revertVariation,
  variationBase,
} from "@/lib/payroll/variations";
import { base as organizationsBase } from "@/lib/queries/admin/organizations";
import { invalidateRepaymentViews } from "./repayments";

const invalidateVariations = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: [variationBase] }),
    queryClient.invalidateQueries({ queryKey: [organizationsBase] }),
  ]);

/**
 * SUPER_ADMIN, confirmed: queues one generation per organization. The jobs finish in the background (each tells every super
 * admin, in-app and by email), so the caller shows what was queued, skipped or refused and the preview refreshes later.
 */
export const generateVariationsMutation = mutationOptions({
  mutationKey: [variationBase, "generate"],
  mutationFn: generateVariations,
  onSuccess: (data) =>
    invalidateVariations().then(() => {
      // Nothing queued (skipped or refused everywhere) isn't a success to celebrate.
      if (data.data && data.data.queued.length === 0) toast.warning(data.message);
      else toast.success(data.message);
    }),
});

/** SUPER_ADMIN, confirmed: settles the month as if nothing came; everyone in it is charged. */
export const markNoPayrollMutation = mutationOptions({
  mutationKey: [variationBase, "no-payroll"],
  mutationFn: markNoPayroll,
  onSuccess: (data) => invalidateRepaymentViews().then(() => toast.success(data.message)),
});

export const revertNoPayrollMutation = mutationOptions({
  mutationKey: [variationBase, "no-payroll", "revert"],
  mutationFn: revertNoPayroll,
  onSuccess: (data) => invalidateRepaymentViews().then(() => toast.success(data.message)),
});

/** SUPER_ADMIN, confirmed: back one version, or no variation at all from version 1. */
export const revertVariationMutation = mutationOptions({
  mutationKey: [variationBase, "revert"],
  mutationFn: revertVariation,
  onSuccess: (data) =>
    Promise.all([invalidateVariations(), invalidateRepaymentViews()]).then(() => toast.success(data.message)),
});
