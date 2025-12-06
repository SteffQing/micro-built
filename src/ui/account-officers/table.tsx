import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn, formatRole } from "@/lib/utils";
import { AvatarImage } from "@/components/ui/avatar";
import UserAvatarComponent from "../settings/user-settings-view/user-avatar";

interface Props {
  list: AccountOfficerDto[];
  loading: boolean;
}

export default function ListOfAccountOfficers({ list, loading }: Props) {
  return (
    <div className="relative w-full overflow-auto">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[300px] text-center">Officer</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Customers</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="px-4">
          {list.length > 0 ? (
            list.map((officer) => (
              <TableRow
                key={officer.id}
                className="group hover:bg-muted/30 transition-colors"
              >
                <TableCell className="font-medium pl-6">
                  <Link
                    href={`/account-officers/${officer.id}`}
                    className="flex items-center gap-3 hover:text-primary transition-colors"
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm border",
                        officer.isSystem &&
                          "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                    >
                      {officer.isSystem ? (
                        <Building2 className="w-5 h-5" />
                      ) : (
                        <UserAvatarComponent
                          name={officer.name}
                          id={officer.id}
                          className="w-10 h-10"
                        />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {officer.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ID: {officer.id}
                      </span>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      officer.role === "SYSTEM"
                        ? "secondary"
                        : officer.role === "ADMIN"
                        ? "default"
                        : "outline"
                    }
                    className={cn(
                      "capitalize",
                      officer.role === "SYSTEM" &&
                        "bg-slate-100 text-slate-700 hover:bg-slate-200",
                      officer.role === "ADMIN" &&
                        "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 shadow-none",
                      officer.role === "MARKETER" &&
                        "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200",
                      officer.role === "SUPER_ADMIN" &&
                        "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200 shadow-none"
                    )}
                  >
                    {formatRole(officer.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {officer.customersCount.toLocaleString()}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                {loading
                  ? "Fetching account officers..."
                  : "No officers found."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
