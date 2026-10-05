import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Icon, icons } from "@/components/icon";
import Link from "next/link";
import { cn, formatRole } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";

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
                          "bg-muted text-muted-foreground border-border"
                      )}
                    >
                      {officer.isSystem ? (
                        <Icon icon={icons.building} size={20} />
                      ) : (
                        <UserAvatar
                          name={officer.name}
                          id={officer.id}
                          size={40}
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold wrap-break-word text-foreground group-hover:text-primary transition-colors">
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
                      officer.isSystem
                        ? "secondary"
                        : officer.role === "ADMIN"
                        ? "default"
                        : "outline"
                    }
                    className={cn(
                      "capitalize",
                      officer.isSystem &&
                        "bg-muted text-muted-foreground hover:bg-muted/80",
                      officer.role === "ADMIN" &&
                        "bg-muted text-muted-foreground hover:bg-muted/80 shadow-none",
                      officer.role === "MARKETER" &&
                        "bg-warning/10 text-warning hover:bg-warning/15 border-warning/30",
                      officer.role === "SUPER_ADMIN" &&
                        "bg-muted text-muted-foreground hover:bg-muted/80 shadow-none"
                    )}
                  >
                    {officer.isSystem ? "System" : formatRole(officer.role ?? "")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Icon icon={icons.userGroup} size={16} className="text-muted-foreground" />
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
