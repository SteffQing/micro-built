"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, MoreHorizontal } from "lucide-react";
import AdminsTable from "./table";
import { useState } from "react";

export default function AdminManagement({ users }: { users: AdminListDto[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Users List</h3>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
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
            <Button onClick={onAddUser} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Add New Admin
            </Button>
          </div>

          <AdminsTable
            users={filteredUsers}
            onEditUser={onEditUser}
            onDeleteUser={onDeleteUser}
          />

          <div className="flex items-center justify-between pt-4">
            <Button variant="ghost" size="sm" disabled>
              Prev
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
              >
                1
              </Button>
              <Button variant="ghost" size="sm">
                2
              </Button>
              <Button variant="ghost" size="sm">
                3
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="text-red-600">
              Next
              <div className="ml-1 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
                1
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
