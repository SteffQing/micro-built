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

const loanRequests = [
  {
    id: "LN-2190",
    name: "Adeoye Praise",
    avatar: "/placeholder.svg?height=32&width=32",
    requestDate: "13 Feb, 2025",
    loanType: "Asset Loan",
    amount: "₦550,000",
    status: "Approved",
  },
  {
    id: "LN-2191",
    name: "Steven King",
    avatar: "/placeholder.svg?height=32&width=32",
    requestDate: "13 Feb, 2025",
    loanType: "Cash Loan",
    amount: "₦550,000",
    status: "Rejected",
  },
  {
    id: "LN-2192",
    name: "Jadesola Cole",
    avatar: "/placeholder.svg?height=32&width=32",
    requestDate: "13 Feb, 2025",
    loanType: "Asset Loan",
    amount: "₦550,000",
    status: "Approved",
  },
  {
    id: "LN-2193",
    name: "Jane Doe",
    avatar: "/placeholder.svg?height=32&width=32",
    requestDate: "13 Feb, 2025",
    loanType: "Cash Loan",
    amount: "₦550,000",
    status: "Pending",
  },
  {
    id: "LN-2194",
    name: "Michael Johnson",
    avatar: "/placeholder.svg?height=32&width=32",
    requestDate: "14 Feb, 2025",
    loanType: "Education Loan",
    amount: "₦750,000",
    status: "Approved",
  },
  {
    id: "LN-2195",
    name: "Sarah Wilson",
    avatar: "/placeholder.svg?height=32&width=32",
    requestDate: "14 Feb, 2025",
    loanType: "Mortgage",
    amount: "₦2,500,000",
    status: "Pending",
  },
];

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "approved":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "rejected":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    case "pending":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
};

export default function LoanRequestTableAdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredRequests, setFilteredRequests] = useState(loanRequests);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    const filtered = loanRequests.filter(
      (request) =>
        request.name.toLowerCase().includes(value.toLowerCase()) ||
        request.id.toLowerCase().includes(value.toLowerCase()) ||
        request.loanType.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredRequests(filtered);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">
          Recent Loan Requests
        </CardTitle>
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
              <TableHead>Request Date</TableHead>
              <TableHead>Loan Type</TableHead>
              <TableHead>Loan Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.slice(0, 4).map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={request.avatar || "/placeholder.svg"}
                        alt={request.name}
                      />
                      <AvatarFallback>
                        {request.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{request.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-green-600 font-medium">
                  {request.id}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {request.requestDate}
                </TableCell>
                <TableCell>{request.loanType}</TableCell>
                <TableCell className="font-medium">{request.amount}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={getStatusColor(request.status)}
                  >
                    {request.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
