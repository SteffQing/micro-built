"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaintenanceMoodControls } from "./maintainance-mode-toggle";
import CommodityList from "./commodity";
import LoanConfigurationCard from "./loan-config";
import AdminManagement from "./admin-mgt";
import { useQuery } from "@tanstack/react-query";
import { adminUsers, configData } from "@/lib/queries/admin/superadmin";
import PageTitle from "@/components/page-title";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const { data } = useQuery(configData);
  const { data: users } = useQuery(adminUsers);
  return (
    <main className="min-h-screen bg-[#fafafa] p-3 lg:p-5 flex flex-col gap-3 lg:gap-5">
      <PageTitle title="Settings" />

      <Tabs
        defaultValue="general"
        className="bg-background rounded border gap-0"
      >
        <div className="flex items-center justify-between p-4 lg:p-6 m-0">
          <TabsList className="grid w-fit grid-cols-2">
            <TabsTrigger value="general">General Settings</TabsTrigger>
            <TabsTrigger value="admin">Admin Management</TabsTrigger>
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
              <MaintenanceMoodControls />
              <Separator />
              <CommodityList commodities={data?.data?.commodities ?? []} />
            </div>
            <div className="border rounded">
              <div className="p-3 lg:p-5">
                <h3 className="text-muted-foreground text-base font-medium">
                  Loan Configurations
                </h3>
              </div>
              <Separator />
              <LoanConfigurationCard
                interestRate={data?.data?.interestRate ?? 0}
                managementFeeRate={data?.data?.managementFeeRate ?? 0}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="admin" className="space-y-6">
          <AdminManagement users={users?.data ?? []} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
