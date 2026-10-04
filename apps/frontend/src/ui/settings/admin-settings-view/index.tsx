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
import { TwoFactorSection } from "../user-settings-view/security";
import { useUserProvider } from "@/store/auth";
import { useSearchParams } from "next/navigation";

export default function SettingsPage() {
  // Admin endpoints are blocked until 2FA is on, so only the Profile and Two-Factor Auth tabs are usable.
  const { twoFactorEnabled } = useUserProvider();
  const locked = twoFactorEnabled === false;
  const view = useSearchParams().get("view");
  const { data, isLoading } = useQuery({ ...configData, enabled: !locked });
  const { data: users } = useQuery({ ...adminUsers, enabled: !locked });

  return (
    <main className="min-h-screen bg-surface-muted p-3 lg:p-5 flex flex-col gap-3 lg:gap-5">
      <PageTitle title="Settings" />

      <Tabs
        defaultValue={locked || view === "authentication" ? "2fa" : "general"}
        key={locked ? "locked" : "open"}
        className="bg-background rounded border gap-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 lg:p-6 m-0">
          <TabsList className="grid w-fit grid-cols-4">
            <TabsTrigger value="general" disabled={locked}>General Settings</TabsTrigger>
            <TabsTrigger value="profile">Profile Settings</TabsTrigger>
            <TabsTrigger value="admin" disabled={locked}>Admin Management</TabsTrigger>
            <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
          </TabsList>
        </div>

        <Separator />

        <TabsContent value="general" className="p-4 lg:p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border  rounded">
              <div className="p-3 lg:p-5">
                <h3 className="text-muted-foregroundtext-base font-medium">
                  System Controls
                </h3>
              </div>
              <Separator />
              <MaintenanceMoodControls
                mode={data?.data?.maintenanceMode || false}
                loading={isLoading}
              />
              <Separator />
              <div className="p-3 lg:p-5 space-y-1">
                <Button onClick={handleViewQueues}>View Queues</Button>
              </div>
              <Separator />
              <div className="p-3 lg:p-5">
                <h4 className="mb-2 text-sm text-muted-foreground font-normal">Commodities</h4>
              </div>
              <Separator /></div>
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
                penaltyRate={data?.data?.penaltyRate ?? null}
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

        <TabsContent value="2fa" className="p-4 lg:p-6">
          <div className="border rounded">
            <TwoFactorSection />
          </div>
        </TabsContent>

        <TabsContent value="admin" className="space-y-6">
          <AdminManagement users={users?.data ?? []} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
