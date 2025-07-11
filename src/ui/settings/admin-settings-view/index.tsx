"use client";

import { SiteSubHeader } from "@/components/site-sub-header";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { GeneralSettings } from "./general_settings_card";
import { UserManagementSettings } from "./user_management";

export function AdminSettingsPage() {
  const [currentTab, setCurrentTab] = useState<
    "general_settings" | "user_management"
  >("general_settings");

  console.log({ currentTab });

  // const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Settings", isCurrentPage: true }]}
        rightContent={<HeaderRightContent />}
      />

      <Card className="bg-background min-h-screen p-5 w-full">
        <Tabs
          defaultValue={currentTab}
          onValueChange={(tab) => {
            console.log({ tab });
            setCurrentTab(tab as "general_settings" | "user_management");
          }}
        >
          <div className="flex justify-between w-full">
            <TabsList>
              <TabsTrigger value="general_settings">
                General Settings
              </TabsTrigger>
              <TabsTrigger value="user_management">User Management</TabsTrigger>
            </TabsList>

            {currentTab === "general_settings" && (
              <Button variant="outline">Save all Settings</Button>
            )}
          </div>
          <TabsContent value="general_settings">
            <GeneralSettings />
          </TabsContent>
          <TabsContent value="user_management">
            <UserManagementSettings />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

const HeaderRightContent = () => {
  return <></>;
};
