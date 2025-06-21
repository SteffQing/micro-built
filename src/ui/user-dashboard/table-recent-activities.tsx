"use client";

import { useState } from "react";
import {
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { columns } from "../admin-customer/customer-table-column";
import { TablePagination } from "../tables/pagination";

// const repaymentData = [
//   {
//     id: "LN-2190",
//     name: "Jadesola Cole",
//     avatar: "/placeholder.svg?height=32&width=32",
//     expectedAmount: "₦550,000",
//     paidAmount: "₦500,000",
//     status: "On Time",
//     date: "05/5/25",
//   },
//   {
//     id: "LN-2190",
//     name: "Jadesola Cole",
//     avatar: "/placeholder.svg?height=32&width=32",
//     expectedAmount: "₦550,000",
//     paidAmount: "₦500,000",
//     status: "Missed",
//     date: "05/5/25",
//   },
//   {
//     id: "LN-2190",
//     name: "Jadesola Cole",
//     avatar: "/placeholder.svg?height=32&width=32",
//     expectedAmount: "₦550,000",
//     paidAmount: "₦500,000",
//     status: "Partial",
//     date: "05/5/25",
//   },
//   {
//     id: "LN-2190",
//     name: "Jadesola Cole",
//     avatar: "/placeholder.svg?height=32&width=32",
//     expectedAmount: "₦550,000",
//     paidAmount: "₦500,000",
//     status: "Failed",
//     date: "05/5/25",
//   },
//   {
//     id: "LN-2191",
//     name: "Michael Johnson",
//     avatar: "/placeholder.svg?height=32&width=32",
//     expectedAmount: "₦750,000",
//     paidAmount: "₦750,000",
//     status: "On Time",
//     date: "06/5/25",
//   },
//   {
//     id: "LN-2192",
//     name: "Sarah Wilson",
//     avatar: "/placeholder.svg?height=32&width=32",
//     expectedAmount: "₦2,500,000",
//     paidAmount: "₦1,200,000",
//     status: "Partial",
//     date: "07/5/25",
//   },
// ];

// const getStatusColor = (status: string) => {
//   switch (status.toLowerCase()) {
//     case "on time":
//       return "bg-green-100 text-green-800 hover:bg-green-100";
//     case "missed":
//       return "bg-gray-100 text-gray-600 hover:bg-gray-100";
//     case "partial":
//       return "bg-orange-100 text-orange-800 hover:bg-orange-100";
//     case "failed":
//       return "bg-red-100 text-red-800 hover:bg-red-100";
//     default:
//       return "bg-gray-100 text-gray-800 hover:bg-gray-100";
//   }
// };

export default function UserRecentActivityTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
   const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
   const [rowSelection, setRowSelection] = useState({});
 
   const table = useReactTable({
     data: customersData,
     columns,
     onSortingChange: setSorting,
     onColumnFiltersChange: setColumnFilters,
     getCoreRowModel: getCoreRowModel(),
     getPaginationRowModel: getPaginationRowModel(),
     getSortedRowModel: getSortedRowModel(),
     getFilteredRowModel: getFilteredRowModel(),
     onColumnVisibilityChange: setColumnVisibility,
     onRowSelectionChange: setRowSelection,
     state: {
       sorting,
       columnFilters,
       columnVisibility,
       rowSelection,
     },
   });
 
   const handleRowClick = (customerId: string) => {
     window.location.href = `/admin/customers/${customerId}`;
   };
 
   return (
     <div className="bg-background rounded-xl">
       <h1 className="py-4 px-4">Customers List</h1>
       <Separator />
       <div className="py-4 px-4 flex items-center justify-between w-full">
         <div className="flex gap-4 mt-4">
           <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
             <Input
               placeholder="Search customers..."
               value={
                 (table.getColumn("name")?.getFilterValue() as string) ?? ""
               }
               onChange={(event) =>
                 table.getColumn("name")?.setFilterValue(event.target.value)
               }
               className="pl-10"
             />
           </div>
           <Button variant="outline" className="flex items-center gap-2">
             <Filter className="w-4 h-4" />
             Filter
           </Button>
         </div>
         <Button className="">+ Add Customer</Button>
       </div>
 
       <Table>
         <TableHeader>
           {table.getHeaderGroups().map((headerGroup) => (
             <TableRow key={headerGroup.id} className="border-b">
               {headerGroup.headers.map((header) => {
                 return (
                   <TableHead
                     key={header.id}
                     className="font-medium text-gray-600"
                   >
                     {header.isPlaceholder
                       ? null
                       : flexRender(
                           header.column.columnDef.header,
                           header.getContext()
                         )}
                   </TableHead>
                 );
               })}
             </TableRow>
           ))}
         </TableHeader>
         <TableBody>
           {table.getRowModel().rows?.length ? (
             table.getRowModel().rows.map((row) => (
               <TableRow
                 key={row.id}
                 data-state={row.getIsSelected() && "selected"}
                 className="border-b hover:bg-gray-50 cursor-pointer"
                 onClick={() => handleRowClick(row.original.id)}
               >
                 {row.getVisibleCells().map((cell) => (
                   <TableCell key={cell.id} className="py-4">
                     {flexRender(cell.column.columnDef.cell, cell.getContext())}
                   </TableCell>
                 ))}
               </TableRow>
             ))
           ) : (
             <TableRow>
               <TableCell colSpan={columns.length} className="h-24 text-center">
                 No results.
               </TableCell>
             </TableRow>
           )}
         </TableBody>
       </Table>
 
       {/* Pagination */}
       <div className="py-4 px-4">
         <TablePagination table={table} />
       </div>
     </div>
   );
}

export type Customer = {
  id: string;
  name: string;
  avatar: string;
  contactInfo: string;
  outstanding: string;
  repaymentStatus: string;
  accountStatus: "Active" | "Suspended" | "Inactive";
};

const customersData: Customer[] = [
  {
    id: "CUS0001",
    name: "Adebayo Okonkwo",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "adebayo.okonkwo@gmail.com",
    outstanding: "₦750,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0002",
    name: "Fatima Ibrahim",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "08123456789",
    outstanding: "₦1,200,000",
    repaymentStatus: "Late",
    accountStatus: "Active",
  },
  {
    id: "CUS0003",
    name: "Chinedu Okoro",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "chinedu.okoro@yahoo.com",
    outstanding: "₦450,000",
    repaymentStatus: "On Time",
    accountStatus: "Suspended",
  },
  {
    id: "CUS0004",
    name: "Aisha Mohammed",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "09087654321",
    outstanding: "₦850,000",
    repaymentStatus: "Defaulted",
    accountStatus: "Inactive",
  },
  {
    id: "CUS0005",
    name: "Emeka Nwachukwu",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "emeka.nwachukwu@hotmail.com",
    outstanding: "₦320,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0006",
    name: "Blessing Adeyemi",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "08056789012",
    outstanding: "₦680,000",
    repaymentStatus: "Early",
    accountStatus: "Active",
  },
  {
    id: "CUS0007",
    name: "Yakubu Garba",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "yakubu.garba@gmail.com",
    outstanding: "₦950,000",
    repaymentStatus: "Late",
    accountStatus: "Suspended",
  },
  {
    id: "CUS0008",
    name: "Ngozi Eze",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "07012345678",
    outstanding: "₦510,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0009",
    name: "Musa Abdullahi",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "musa.abdullahi@outlook.com",
    outstanding: "₦1,150,000",
    repaymentStatus: "Defaulted",
    accountStatus: "Inactive",
  },
  {
    id: "CUS0010",
    name: "Chioma Okafor",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "08134567890",
    outstanding: "₦380,000",
    repaymentStatus: "Early",
    accountStatus: "Active",
  },
  {
    id: "CUS0011",
    name: "Ibrahim Suleiman",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "ibrahim.suleiman@gmail.com",
    outstanding: "₦720,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0012",
    name: "Funmi Akinyemi",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "09098765432",
    outstanding: "₦590,000",
    repaymentStatus: "Late",
    accountStatus: "Suspended",
  },
  {
    id: "CUS0013",
    name: "Kemi Adesanya",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "kemi.adesanya@yahoo.com",
    outstanding: "₦440,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0014",
    name: "Uche Obi",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "08167890123",
    outstanding: "₦880,000",
    repaymentStatus: "Defaulted",
    accountStatus: "Inactive",
  },
  {
    id: "CUS0015",
    name: "Zainab Yusuf",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "zainab.yusuf@gmail.com",
    outstanding: "₦630,000",
    repaymentStatus: "Early",
    accountStatus: "Active",
  },
  {
    id: "CUS0016",
    name: "Tunde Adebayo",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "07023456789",
    outstanding: "₦1,050,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0017",
    name: "Grace Nwosu",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "grace.nwosu@hotmail.com",
    outstanding: "₦270,000",
    repaymentStatus: "Late",
    accountStatus: "Suspended",
  },
  {
    id: "CUS0018",
    name: "Aliyu Hassan",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "08145678901",
    outstanding: "₦760,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0019",
    name: "Folake Oyedepo",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "folake.oyedepo@gmail.com",
    outstanding: "₦920,000",
    repaymentStatus: "Defaulted",
    accountStatus: "Inactive",
  },
  {
    id: "CUS0020",
    name: "Biodun Ogundimu",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "09034567890",
    outstanding: "₦350,000",
    repaymentStatus: "Early",
    accountStatus: "Active",
  },
  {
    id: "CUS0021",
    name: "Amina Bello",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "amina.bello@outlook.com",
    outstanding: "₦650,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0022",
    name: "Chidi Okafor",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "08178901234",
    outstanding: "₦1,300,000",
    repaymentStatus: "Late",
    accountStatus: "Suspended",
  },
  {
    id: "CUS0023",
    name: "Remi Afolabi",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "remi.afolabi@yahoo.com",
    outstanding: "₦480,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0024",
    name: "Hauwa Garba",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "07045678912",
    outstanding: "₦800,000",
    repaymentStatus: "Defaulted",
    accountStatus: "Inactive",
  },
  {
    id: "CUS0025",
    name: "Olumide Adegbite",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "olumide.adegbite@gmail.com",
    outstanding: "₦570,000",
    repaymentStatus: "Early",
    accountStatus: "Active",
  },
  {
    id: "CUS0026",
    name: "Nkem Okonkwo",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "08156789023",
    outstanding: "₦690,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0027",
    name: "Sadiq Usman",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "sadiq.usman@hotmail.com",
    outstanding: "₦1,100,000",
    repaymentStatus: "Late",
    accountStatus: "Suspended",
  },
  {
    id: "CUS0028",
    name: "Yemi Adebola",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "09067890134",
    outstanding: "₦420,000",
    repaymentStatus: "On Time",
    accountStatus: "Active",
  },
  {
    id: "CUS0029",
    name: "Ifeoma Nwogu",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "ifeoma.nwogu@gmail.com",
    outstanding: "₦780,000",
    repaymentStatus: "Defaulted",
    accountStatus: "Inactive",
  },
  {
    id: "CUS0030",
    name: "Bashir Danjuma",
    avatar: "/placeholder.svg?height=32&width=32",
    contactInfo: "08189012345",
    outstanding: "₦620,000",
    repaymentStatus: "Early",
    accountStatus: "Active",
  },
];
