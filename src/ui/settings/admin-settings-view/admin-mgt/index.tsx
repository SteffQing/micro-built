"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, MoreHorizontal } from "lucide-react";
import AdminsTable from "./table";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { AddNewAdminDialog } from "./add-admin-dialog";
import { useUserProvider } from "@/store/auth";

export default function AdminManagement({ users }: { users: AdminListDto[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const { userRole } = useUserProvider();
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      activeTab === "active"
        ? user.status === "ACTIVE"
        : user.status === "FLAGGED";

    return matchesSearch && matchesStatus;
  });

  // Placeholder functions for add, edit, and remove actions
  function onAddUser() {
    // TODO: Implement add user functionality
    alert("Add user clicked (placeholder)");
  }

  function onEditUser(user: AdminListDto) {
    // TODO: Implement edit user functionality
    alert(`Edit user: ${user.name} (placeholder)`);
  }

  function onDeleteUser(userId: string) {
    // TODO: Implement delete user functionality
    alert(`Delete user with ID: ${userId} (placeholder)`);
  }

  return (
    <div className="">
      <div className="p-3 lg:p-5">
        <h3 className="text-muted-foreground text-base font-medium">
          Admin List
        </h3>
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-4 p-3 lg:p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger
                value="active"
                className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700"
              >
                Active
              </TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {userRole === "SUPER_ADMIN" && <AddNewAdminDialog />}
      </div>

      <Separator className="bg-[#F0F0F0] m-0" />
      <div className="p-3 lg:p-5">
        <AdminsTable
          users={filteredUsers}
          onEditUser={onEditUser}
          onDeleteUser={onDeleteUser}
        />
      </div>
    </div>
  );
}
