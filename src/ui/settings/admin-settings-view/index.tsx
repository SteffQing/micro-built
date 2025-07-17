"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SystemControls from "./system-controls";
import CommodityList from "./commodity";
import LoanConfigurationCard from "./loan-config";
import AdminManagement from "./admin-mgt";
import { useQuery } from "@tanstack/react-query";
import { adminUsers, configData } from "@/lib/queries/admin/superadmin";

export default function SettingsPage() {
  const { data } = useQuery(configData);
  const { data: users } = useQuery(adminUsers);
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <div className="p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="general">Config Settings</TabsTrigger>
              <TabsTrigger value="admin">Admin Management</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <SystemControls mode={data?.data?.maintenanceMode ?? false} />
                <CommodityList commodities={data?.data?.commodities ?? []} />
              </div>
              <div>
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
      </div>
    </div>
  );
}
