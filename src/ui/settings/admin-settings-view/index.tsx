"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import SystemControls from "./system-controls";
import CommodityList from "./commodity";
import LoanConfigurationCard from "./loan-config";
import AdminManagement from "./admin-mgt";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      <div className="p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="general">General Settings</TabsTrigger>
              <TabsTrigger value="admin">Admin Management</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
              <Button
                onClick={handleSaveChanges}
                className="text-red-600 bg-transparent border border-red-200 hover:bg-red-50"
              >
                Save all changes
              </Button>
            </div>
          </div>

          <TabsContent value="general" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <SystemControls
                  maintenanceMode={systemSettings.maintenanceMode}
                  onMaintenanceModeChange={(enabled) =>
                    setSystemSettings({
                      ...systemSettings,
                      maintenanceMode: enabled,
                    })
                  }
                />
                <CommodityList
                  commodities={commodities}
                  onAddCommodity={handleAddCommodity}
                  onRemoveCommodity={handleRemoveCommodity}
                />
              </div>
              <div>
                <LoanConfigurationCard
                  configuration={loanConfig}
                  onConfigurationChange={setLoanConfig}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="admin" className="space-y-6">
            <AdminManagement
              users={users}
              onAddUser={handleAddUser}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              onDownloadCSV={handleDownloadCSV}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
