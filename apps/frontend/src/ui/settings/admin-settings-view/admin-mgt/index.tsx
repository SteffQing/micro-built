"use client";

import { Input } from "@/components/ui/input";
import { Icon, icons } from "@/components/icon";
import AdminsTable from "./table";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { AddNewAdminDialog } from "./add-admin-dialog";

export default function AdminManagement({ users }: { users: AdminListDto[] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="">
      <div className="p-3 lg:p-5">
        <h3 className="text-muted-foreground text-base font-medium">
          Admin List
        </h3>
      </div>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 lg:p-5">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Icon icon={icons.search} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 min-w-64 w-full"
            />
          </div>
        </div>
        <AddNewAdminDialog />
      </div>

      <Separator className="bg-border m-0" />
      <div className="p-3 lg:p-5">
        <AdminsTable users={filteredUsers} />
      </div>
    </div>
  );
}
