import Link from "next/link";
import { Icon, icons } from "@/components/icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthTitle } from "@/lib/payroll/variations";

interface Props {
  list: OrganizationDto[];
  loading: boolean;
}

export default function ListOfOrganizations({ list, loading }: Props) {
  return (
    <div className="relative w-full overflow-auto">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[300px] pl-6">Organization</TableHead>
            <TableHead>Customers</TableHead>
            <TableHead>Running loans</TableHead>
            <TableHead>Latest locked month</TableHead>
            <TableHead>Waiting for a voucher</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="px-4">
          {list.length > 0 ? (
            list.map((organization) => (
              <TableRow key={organization.id} className="group transition-colors hover:bg-muted/30">
                <TableCell className="pl-6 font-medium">
                  <Link
                    href={`/organizations/${organization.id}`}
                    className="flex items-center gap-3 transition-colors hover:text-primary"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-muted-foreground shadow-sm">
                      <Icon icon={icons.building} size={20} />
                    </div>
                    <span className="text-sm font-semibold wrap-break-word text-foreground transition-colors group-hover:text-primary">
                      {organization.name}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Icon icon={icons.userGroup} size={16} className="text-muted-foreground" />
                    <span className="font-medium">{organization.customers.toLocaleString()}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{organization.runningLoans.toLocaleString()}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {organization.latestLocked ? (
                    monthTitle(organization.latestLocked.ym)
                  ) : (
                    <span className="text-xs text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {organization.unlocked.length === 0 ? (
                    <span className="text-xs text-muted-foreground">None</span>
                  ) : (
                    <span className="whitespace-nowrap">
                      {organization.unlocked.map((item) => monthTitle(item.ym)).join(", ")}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                {loading ? "Fetching organizations..." : "No organizations found."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
