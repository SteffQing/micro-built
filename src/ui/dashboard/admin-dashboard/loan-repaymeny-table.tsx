"use client";

import { useState } from "react";
import { Search, Filter, ChevronRight } from "lucide-react";
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

const repaymentData = [
  {
    id: "LN-2190",
    name: "Jadesola Cole",
    avatar: "/placeholder.svg?height=32&width=32",
    expectedAmount: "₦550,000",
    paidAmount: "₦500,000",
    status: "On Time",
    date: "05/5/25",
  },
  {
    id: "LN-2190",
    name: "Jadesola Cole",
    avatar: "/placeholder.svg?height=32&width=32",
    expectedAmount: "₦550,000",
    paidAmount: "₦500,000",
    status: "Missed",
    date: "05/5/25",
  },
  {
    id: "LN-2190",
    name: "Jadesola Cole",
    avatar: "/placeholder.svg?height=32&width=32",
    expectedAmount: "₦550,000",
    paidAmount: "₦500,000",
    status: "Partial",
    date: "05/5/25",
  },
  {
    id: "LN-2190",
    name: "Jadesola Cole",
    avatar: "/placeholder.svg?height=32&width=32",
    expectedAmount: "₦550,000",
    paidAmount: "₦500,000",
    status: "Failed",
    date: "05/5/25",
  },
  {
    id: "LN-2191",
    name: "Michael Johnson",
    avatar: "/placeholder.svg?height=32&width=32",
    expectedAmount: "₦750,000",
    paidAmount: "₦750,000",
    status: "On Time",
    date: "06/5/25",
  },
  {
    id: "LN-2192",
    name: "Sarah Wilson",
    avatar: "/placeholder.svg?height=32&width=32",
    expectedAmount: "₦2,500,000",
    paidAmount: "₦1,200,000",
    status: "Partial",
    date: "07/5/25",
  },
];

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "on time":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "missed":
      return "bg-gray-100 text-gray-600 hover:bg-gray-100";
    case "partial":
      return "bg-orange-100 text-orange-800 hover:bg-orange-100";
    case "failed":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
};

export default function RepaymentTableAdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredData, setFilteredData] = useState(repaymentData);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    const filtered = repaymentData.filter(
      (item) =>
        item.name.toLowerCase().includes(value.toLowerCase()) ||
        item.id.toLowerCase().includes(value.toLowerCase()) ||
        item.status.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredData(filtered);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">Repayment</CardTitle>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          See all
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Loan ID</TableHead>
              <TableHead>Expected Amount</TableHead>
              <TableHead>Paid Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.slice(0, 4).map((item, index) => (
              <TableRow key={`${item.id}-${index}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={item.avatar || "/placeholder.svg"}
                        alt={item.name}
                      />
                      <AvatarFallback>
                        {item.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{item.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-green-600 font-medium">
                  {item.id}
                </TableCell>
                <TableCell className="font-medium">
                  {item.expectedAmount}
                </TableCell>
                <TableCell className="font-medium">{item.paidAmount}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={getStatusColor(item.status)}
                  >
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.date}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
