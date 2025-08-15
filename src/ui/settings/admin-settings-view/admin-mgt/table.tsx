"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import RemoveAdmin from "./remove-admin-dialog";
import UserAvatarComponent from "../../user-settings-view/user-avatar";

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
            <TableHead className="w-[100px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <UserAvatarComponent id={user.id} className="w-8 h-8" name={user.name} />
                  <span className="font-medium">{user.name}</span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">{user.id}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>
                <Badge
                  variant={user.status === "ACTIVE" ? "default" : "secondary"}
                  className={user.status === "ACTIVE" ? "bg-green-100 text-green-700" : ""}
                >
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell>
                <RemoveAdmin id={user.id} name={user.name} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
