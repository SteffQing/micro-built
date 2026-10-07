"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaintenanceMoodControls } from "./maintainance-mode-toggle";
import LoanConfigurationCard from "./loan-config";
import AdminManagement from "./admin-mgt";
import { useQuery } from "@tanstack/react-query";
import { adminUsers, configData } from "@/lib/queries/admin/superadmin";
import PageTitle from "@/components/page-title";
import { Separator } from "@/components/ui/separator";
import { ProfileInformation } from "../user-settings-view/profile-information";
import { UpdatePassword } from "../user-settings-view/update-password";
import { Button } from "@/components/ui/button";
import { handleViewQueues } from "@/lib/axios";
import { PasskeysSection, SessionsSection, TwoFactorSection } from "../user-settings-view/security";
import { useUserProvider } from "@/store/auth";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon, icons } from "@/components/icon";
import { SettingRow } from "./setting-row";

export default function SettingsPage() {
  // A super admin is blocked from admin endpoints until 2FA or a passkey is set up, so only the Account, Security and
  // 2FA & Passkeys tabs are usable until then.
  const { needsStrongFactor } = useUserProvider();
  const locked = needsStrongFactor;
  const view = useSearchParams().get("view");
  const { data, isLoading } = useQuery({ ...configData, enabled: !locked });
  const { data: users } = useQuery({ ...adminUsers, enabled: !locked });

  return (
    <main className="min-h-screen bg-surface-muted p-3 lg:p-5 flex flex-col gap-3 lg:gap-5">
      <PageTitle title="Settings" />

      <Tabs
        defaultValue={locked || view === "authentication" ? "2fa" : view === "security" ? "security" : "general"}
        key={locked ? "locked" : "open"}
        className="bg-background rounded border gap-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 lg:p-6 m-0">
          <TabsList className="thin-scroll h-auto w-full max-w-full justify-start overflow-x-auto sm:w-fit">
            <TabsTrigger value="general" disabled={locked}>Platform Settings</TabsTrigger>
            <TabsTrigger value="admin" disabled={locked}>Admin Management</TabsTrigger>
            <TabsTrigger value="profile">Account Settings</TabsTrigger>
            <TabsTrigger value="security">Security Settings</TabsTrigger>
            <TabsTrigger value="2fa">2FA &amp; Passkeys</TabsTrigger>
          </TabsList>
        </div>

        <Separator />

        <TabsContent value="general" className="p-4 lg:p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border rounded">
              <div className="p-3 lg:p-5">
                <h3 className="text-muted-foreground text-base font-medium">
                  System Controls
                </h3>
              </div>
              <Separator />
              <MaintenanceMoodControls
                mode={data?.data?.maintenanceMode || false}
                loading={isLoading}
              />
              <Separator />
              <SettingRow
                title="Background queues"
                description="Monitor payroll imports, notifications and other background jobs."
              >
                <Button variant="outline" size="sm" onClick={handleViewQueues}>
                  Open queues
                  <Icon icon={icons.arrowUpRight} size={14} />
                </Button>
              </SettingRow>
              <Separator />
              <SettingRow
                title="Commodities"
                description="Manage the commodity catalogue customers can request loans for."
              >
                <Button variant="outline" size="sm" asChild>
                  <Link href="/commodities">
                    Manage
                    <Icon icon={icons.chevronRight} size={14} />
                  </Link>
                </Button>
              </SettingRow>
            </div>
            <div className="border rounded">
              <div className="p-3 lg:p-5">
                <h3 className="text-muted-foreground text-base font-medium">
                  Loan Configurations
                </h3>
              </div>
              <Separator />
              <LoanConfigurationCard
                interestRate={data?.data?.interestRate ?? null}
                managementFeeRate={data?.data?.managementFeeRate ?? null}
                penaltyRate={data?.data?.penaltyFeeRate ?? null}
                maxDeductionRate={data?.data?.maxDeductionRate ?? null}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="p-4 lg:p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border rounded">
              <ProfileInformation />
            </div>
            <div className="border rounded">
              <UpdatePassword />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="p-4 lg:p-6">
          <SessionsSection />
        </TabsContent>

        <TabsContent value="2fa" className="space-y-6 p-4 lg:p-6">
          <p className="text-sm text-muted-foreground">
            Core actions like disbursements, voucher uploads, variations and settings ask for your authenticator code
            or a passkey.
          </p>
          <PasskeysSection />
          <TwoFactorSection />
        </TabsContent>

        <TabsContent value="admin" className="space-y-6">
          <AdminManagement users={users?.data ?? []} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
