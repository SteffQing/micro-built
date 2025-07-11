"use client";

import { useMemo, useState } from "react";
import { Search, Filter, Eye, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminCashLoansListsQueryOptions,
  AdminCashLoansListsResponse,
} from "@/lib/queries/admin-loans-lists";
import { useQuery } from "@tanstack/react-query";
import { LoanStatus } from "@/lib/queries/query-types";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { TableLoadingSkeleton } from "../tables/table-skeleton-loader";
import { TableEmptyState } from "../tables/table-empty-state";

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "closed":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "defaulted":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    case "pending":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
};

const columns: ColumnDef<AdminCashLoansListsResponse["data"][0]>[] = [
  {
    id: "select",
    header: ({}) => <p>Date</p>,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
        <p>{formatDate(row.original.date, "PPpp")}</p>
      </div>
    ),
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: "customerId",
    header: "Name",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={`/placeholder.svg?height=32&width=32`}
              alt={row.getValue("customerId")}
            />
            <AvatarFallback>{row.getValue("customerId")}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{row.getValue("customerId")}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "id",
    header: "Loan ID",
    cell: ({ row }) => (
      <span className="text-green-600 font-medium">{row.getValue("id")}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("amount"))}
      </span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.getValue("category")}
      </Badge>
    ),
  },
  {
    accessorKey: "loanTenure",
    header: "Tenure",
    cell: ({ row }) => `${row.getValue("loanTenure")} months`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={getStatusColor(row.getValue("status"))}
      >
        {row.getValue("status")}
      </Badge>
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => {
      const loan = row.original;
      return (
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                // onClick={() => setSelectedLoan(loan)}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Loan Details - {loan.id}</DialogTitle>
              </DialogHeader>
              {/* {selectedLoan && <LoanDetailsDialog loan={selectedLoan} />} */}
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {loan.status === "PENDING" && (
                <>
                  <DropdownMenuItem className="text-green-600">
                    Approve Loan
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">
                    Reject Loan
                  </DropdownMenuItem>
                </>
              )}
              {loan.status === "APPROVED" && (
                <DropdownMenuItem className="text-blue-600">
                  Disburse Loan
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export function LoanManagementTable() {
  const [page] = useState(1);
  const [limit] = useState(20);
  const [status] = useState<LoanStatus | undefined>(undefined);
  const [searchTerm] = useState("");

  const { data, isLoading } = useQuery({
    ...adminCashLoansListsQueryOptions({
      page,
      limit,
      status,
    }),
  });

  const filteredData = useMemo(() => {
    if (!data?.data) return [];

    return data.data.filter((loan) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        loan.id.toLowerCase().includes(searchLower) ||
        loan.customerId.toLowerCase().includes(searchLower) ||
        loan.category.toLowerCase().includes(searchLower)
      );
    });
  }, [data?.data, searchTerm]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // getRowSelectionModel: getRowSelectionModel(),
    // onRowSelectionChange: setRowSelection,
    // state: {
    //   rowSelection,
    // },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="w-full space-y-6 bg-background">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Loan Management Table
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search"
                value={searchTerm}
                // onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Select defaultValue="all">
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Loans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Loans</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="defaulted">Defaulted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableLoadingSkeleton columns={6} />
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-center py-8"
                    >
                      {searchTerm
                        ? "No loans found matching your search."
                        : "No loans found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableEmptyState colSpan={6} />
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
