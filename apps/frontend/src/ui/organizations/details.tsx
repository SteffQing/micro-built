"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import PageTitle from "@/components/page-title";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { monthTitle } from "@/lib/payroll/variations";
import { organizationCustomersList, organizationDetail, organizationStats } from "@/lib/queries/admin/organizations";
import { useUserProvider } from "@/store/auth";
import { CustomerGroupTable } from "@/ui/account-officers/details/customers-table";
import { CustomerGroupStatsCards } from "@/ui/account-officers/details/stats-cards";
import { DeleteOrganizationDialog } from "./delete-organization";
import { MergeOrganizationDialog } from "./merge-organization";
import { OrganizationNameDialog } from "./organization-name-dialog";

/** One organization: where its payroll stands, its customers' figures and its customers. */
export default function OrganizationDetailsView({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const { userRole } = useUserProvider();
  const superAdmin = userRole === "SUPER_ADMIN";
  const { data, isLoading, isError } = useQuery(organizationDetail(organizationId));
  const stats = useQuery(organizationStats(organizationId));
  const organization = data?.data;
  const listQuery = useCallback(
    (params: AccountOfficerCustomersQuery) => organizationCustomersList(organizationId, params),
    [organizationId],
  );

  if (!isLoading && (isError || !organization)) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:px-8">
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm font-medium">That organization doesn&apos;t exist (any more)</p>
          <p className="mt-1 text-xs text-muted-foreground">It may have been merged into another or deleted.</p>
          <Button asChild variant="outline" className="mt-4 h-9">
            <Link href="/organizations">All organizations</Link>
          </Button>
        </div>
      </div>
    );
  }

  const name = organization?.name ?? "…";
  return (
    <div className="@container/main mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
      <PageTitle
        title={`${name} · Organization`}
        actionContent={
          organization && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end [&>a]:h-9 [&>button]:h-9">
              {superAdmin && (
                <>
                  <OrganizationNameDialog
                    organization={organization}
                    trigger={
                      <Button type="button" variant="outline">
                        <Icon icon={icons.edit} size={16} />
                        Rename
                      </Button>
                    }
                  />
                  <MergeOrganizationDialog
                    organization={organization}
                    onMerged={(intoId) => router.replace(`/organizations/${intoId}`)}
                    trigger={
                      <Button type="button" variant="outline">
                        <Icon icon={icons.building} size={16} />
                        Merge into another
                      </Button>
                    }
                  />
                  <DeleteOrganizationDialog
                    organization={organization}
                    onDeleted={() => router.replace("/organizations")}
                    trigger={
                      <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
                        <Icon icon={icons.delete} size={16} />
                        Delete
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          )
        }
      />

      {organization && (
        <section className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Running loans</p>
            <p className="mt-0.5 font-medium">{organization.runningLoans.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Latest locked month</p>
            <p className="mt-0.5 font-medium">
              {organization.latestLocked ? monthTitle(organization.latestLocked.ym) : "Never"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Waiting for a voucher</p>
            <p className="mt-0.5 font-medium">
              {organization.unlocked.length
                ? organization.unlocked.map((item) => `${monthTitle(item.ym)} (v${item.version})`).join(", ")
                : "None"}
            </p>
          </div>
        </section>
      )}

      <CustomerGroupStatsCards stats={stats.data?.data} loading={stats.isLoading} label="Organization metrics" />

      <CustomerGroupTable
        title="Customers"
        groupKey={organizationId}
        listQuery={listQuery}
        emptyDescription={(status) => `No customers in ${name} with ${status} status`}
      />
    </div>
  );
}
