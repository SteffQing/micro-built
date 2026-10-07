"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { currentLagosMonth, getVariationHistory, variationBase, variationHistoryKey } from "@/lib/payroll/variations";
import { organizationsList } from "@/lib/queries/admin/organizations";
import { useUserProvider } from "@/store/auth";
import UploadVoucher from "@/ui/modals/upload-voucher";
import { MonthPicker } from "./month-picker";
import { ALL_ORGANIZATIONS, OrganizationSelect } from "./organization-select";
import { OrganizationsOverview } from "./organizations-overview";
import { HistoryList, VariationDetail } from "./variation-detail";

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Per-organization variations. `?organizationId=<id>|all` and `?period=YYYY-MM` keep the view linkable (notification and
 * dashboard links land here). One organization shows its variation for the month, with its history; "all" shows every
 * organization at a glance and generates for all of them.
 */
export function VariationsPage() {
  const { userRole } = useUserProvider();
  const superAdmin = userRole === "SUPER_ADMIN";
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();

  const organizationId = params.get("organizationId") ?? ALL_ORGANIZATIONS;
  const single = organizationId !== ALL_ORGANIZATIONS;
  const periodParam = params.get("period");
  const organizations = useQuery(organizationsList);
  const organization = single ? (organizations.data?.data ?? []).find((item) => item.id === organizationId) : undefined;
  const history = useQuery({
    queryKey: variationHistoryKey(organizationId),
    queryFn: () => getVariationHistory(organizationId),
    enabled: single,
    retry: 1,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === organizationId ? previous : undefined),
  });

  // A month in the link wins; otherwise the earliest month still waiting for a voucher (what needs attention), else now.
  const period =
    periodParam && YM.test(periodParam)
      ? periodParam
      : single
        ? (organization?.unlocked[0]?.ym ?? currentLagosMonth())
        : currentLagosMonth();
  const settled = !single || periodParam !== null || organizations.isSuccess || organizations.isError;

  const show = useCallback(
    (next: { organizationId?: string; period?: string | null }) => {
      const query = new URLSearchParams(params.toString());
      if (next.organizationId !== undefined) {
        if (next.organizationId === ALL_ORGANIZATIONS) query.delete("organizationId");
        else query.set("organizationId", next.organizationId);
      }
      if (next.period !== undefined) {
        if (next.period) query.set("period", next.period);
        else query.delete("period");
      }
      const text = query.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return <div className="p-6 text-center text-muted-foreground">You do not have access to this page.</div>;
  }

  return (
    <main className="space-y-3 p-3 lg:space-y-5 lg:p-5">
      <PageTitle
        title="Variations"
        actionContent={
          superAdmin ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end [&>button]:h-9">
              {/* Keyed so the organization picked above is the one the dialog starts with. */}
              <UploadVoucher key={organizationId} defaultOrganizationId={single ? organizationId : ""} />
            </div>
          ) : undefined
        }
      />

      <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 sm:p-4">
        <div className="grid w-full gap-1.5 sm:w-64">
          <Label htmlFor="variation-organization" className="text-xs text-muted-foreground">
            Organization
          </Label>
          <OrganizationSelect
            id="variation-organization"
            value={organizationId}
            onChange={(value) => show({ organizationId: value })}
            allowAll
          />
        </div>
        <div className="grid w-full gap-1.5 sm:w-56">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <MonthPicker value={period} onChange={(value) => show({ period: value })} />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => void queryClient.invalidateQueries({ queryKey: [variationBase] })}
          >
            <Icon icon={icons.refresh} size={16} />
            Refresh
          </Button>
        </div>
      </section>

      {!single ? (
        <OrganizationsOverview
          period={period}
          superAdmin={superAdmin}
          onOpen={(id) => show({ organizationId: id, period })}
        />
      ) : !settled ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !organization ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm font-medium">That organization doesn&apos;t exist (any more)</p>
          <p className="mt-1 text-xs text-muted-foreground">It may have been merged into another. Pick one above.</p>
        </div>
      ) : (
        <VariationDetail
          // A fresh state (filters, waiting for a job) for each organization and month.
          key={`${organization.id}:${period}`}
          organization={organization}
          period={period}
          superAdmin={superAdmin}
          history={history.data ?? []}
          aside={
            <HistoryList
              items={history.data ?? []}
              selected={period}
              onSelect={(value) => show({ period: value })}
              organizationName={organization.name}
              loading={history.isLoading}
            />
          }
        />
      )}
    </main>
  );
}
