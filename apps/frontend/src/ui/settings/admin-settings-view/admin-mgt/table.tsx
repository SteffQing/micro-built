"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ManageAdminDialog, ROLE_LABEL } from "./manage-admin-dialog";
import { UserAvatar } from "@/components/user-avatar";

interface UsersTableProps {
  users: AdminListDto[];
}

export default function AdminsTable({ users }: UsersTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>User ID</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">
              <span className="sr-only">Manage</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <UserAvatar id={user.id} name={user.name} size={32} />
                  <span className="font-medium">{user.name}</span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">{user.id}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role}</TableCell>
              <TableCell>
                <Badge
                  variant={user.status === "ACTIVE" ? "default" : "secondary"}
                  className={user.status === "ACTIVE" ? "bg-success/10 text-success" : ""}
                >
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell>
                <ManageAdminDialog admin={user} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
