"use client";

import { useState } from "react";
import { Search, Filter, Eye, Trash2, MoreHorizontal, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const loanData = [
  {
    id: "LN-2190",
    name: "Jadesola Cole",
    avatar: "/placeholder.svg?height=32&width=32",
    loanAmount: "₦500,000",
    requestDate: "13, Feb 2025",
    interests: "₦30,000",
    balance: "₦100,000",
    tenure: "12 Months",
    status: "Active",
    description: "Business expansion loan",
    purpose: "Inventory purchase",
    collateral: "Property deed",
    guarantor: "John Doe",
    phone: "+234 901 234 5678",
    email: "jadesola@email.com",
  },
  {
    id: "LN-2191",
    name: "Michael Johnson",
    avatar: "/placeholder.svg?height=32&width=32",
    loanAmount: "₦750,000",
    requestDate: "15, Feb 2025",
    interests: "₦45,000",
    balance: "₦200,000",
    tenure: "18 Months",
    status: "Active",
    description: "Equipment financing",
    purpose: "Machinery purchase",
    collateral: "Equipment warranty",
    guarantor: "Jane Smith",
    phone: "+234 902 345 6789",
    email: "michael@email.com",
  },
  {
    id: "LN-2192",
    name: "Sarah Wilson",
    avatar: "/placeholder.svg?height=32&width=32",
    loanAmount: "₦300,000",
    requestDate: "10, Feb 2025",
    interests: "₦18,000",
    balance: "₦0",
    tenure: "6 Months",
    status: "Closed",
    description: "Personal loan",
    purpose: "Medical expenses",
    collateral: "Salary assignment",
    guarantor: "Robert Brown",
    phone: "+234 903 456 7890",
    email: "sarah@email.com",
  },
  {
    id: "LN-2193",
    name: "David Chen",
    avatar: "/placeholder.svg?height=32&width=32",
    loanAmount: "₦1,200,000",
    requestDate: "08, Feb 2025",
    interests: "₦72,000",
    balance: "₦800,000",
    tenure: "24 Months",
    status: "Defaulted",
    description: "Real estate investment",
    purpose: "Property acquisition",
    collateral: "Land documents",
    guarantor: "Emily Davis",
    phone: "+234 904 567 8901",
    email: "david@email.com",
  },
];

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

export default function LoanManagementTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredData, setFilteredData] = useState(loanData);
  interface Loan {
  id: string;
  name: string;
  avatar: string;
  loanAmount: string;
  requestDate: string;
  interests: string;
  balance: string;
  tenure: string;
  status: string;
  description?: string;
  purpose?: string;
  collateral?: string;
  guarantor?: string;
  phone?: string;
  email?: string;
}

  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [topUpLoan, setTopUpLoan] = useState<Loan | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    const filtered = loanData.filter(
      (item) =>
        item.name.toLowerCase().includes(value.toLowerCase()) ||
        item.id.toLowerCase().includes(value.toLowerCase()) ||
        item.status.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredData(filtered);
  };

  const openLoanDetails = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDetailsOpen(true);
  };

  const openEditLoan = (loan: Loan) => {
    setEditLoan({ ...loan });
    setIsEditOpen(true);
  };

  const openTopUp = (loan: Loan) => {
    setTopUpLoan(loan);
    setIsTopUpOpen(true);
  };

  const handleEditSave = () => {
    // Update loan logic here
    setIsEditOpen(false);
    setEditLoan(null);
  };

  const handleTopUpConfirm = () => {
    // Top up logic here
    setIsTopUpOpen(false);
    setTopUpLoan(null);
  };

  return (
    <div className="w-full space-y-6">
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
                onChange={(e) => handleSearch(e.target.value)}
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Loan ID</TableHead>
                <TableHead>Loan Amount</TableHead>
                <TableHead>Request Date</TableHead>
                <TableHead>Interests(₦)</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Tenure</TableHead>
                <TableHead>Loan Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((loan, index) => (
                <TableRow key={`${loan.id}-${index}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={loan.avatar || "/placeholder.svg"}
                          alt={loan.name}
                        />
                        <AvatarFallback>
                          {loan.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{loan.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">
                    {loan.id}
                  </TableCell>
                  <TableCell className="font-medium">
                    {loan.loanAmount}
                  </TableCell>
                  <TableCell>{loan.requestDate}</TableCell>
                  <TableCell>{loan.interests}</TableCell>
                  <TableCell className="font-medium">
                    {loan.balance === "₦0" ? "——" : loan.balance}
                  </TableCell>
                  <TableCell>{loan.tenure}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={getStatusColor(loan.status)}
                    >
                      {loan.status}
                      {loan.status === "Closed" && " ✓"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-green-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openLoanDetails(loan)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditLoan(loan)}>
                            Edit Loan
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openTopUp(loan)}>
                            Top Up Loan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Loan Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Loan Details</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDetailsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Customer ID
                  </Label>
                  <p className="font-medium text-green-600">
                    {selectedLoan.id}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Loan Amount
                  </Label>
                  <p className="font-medium">{selectedLoan.loanAmount}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Loan Tenure
                  </Label>
                  <p className="font-medium">{selectedLoan.tenure}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Interest Amount
                  </Label>
                  <p className="font-medium">{selectedLoan.interests}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Amount Repaid
                  </Label>
                  <p className="font-medium">₦400,000</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Outstanding Loan
                  </Label>
                  <p className="font-medium">{selectedLoan.balance}</p>
                </div>
              </div>
              <div className="pt-4">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Add Top Up
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Loan Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Edit Loan Details</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          {editLoan && (
            <div className="space-y-4">
              <div>
                <Label>Loan Amount</Label>
                <Input
                  value={editLoan.loanAmount}
                  onChange={(e) =>
                    setEditLoan({ ...editLoan, loanAmount: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Loan Interest Rate</Label>
                <div className="flex items-center gap-2">
                  <Input defaultValue="6" className="flex-1" />
                  <span className="text-2xl font-bold text-green-600">%</span>
                </div>
              </div>
              <div>
                <Label>Loan Tenure (in Months)</Label>
                <Select defaultValue="30">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 Days</SelectItem>
                    <SelectItem value="12">12 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleEditSave}
              >
                Confirm
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Top Up Modal */}
      <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Top up Modal</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTopUpOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          {topUpLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Loan ID
                  </Label>
                  <p className="font-medium text-green-600">{topUpLoan.id}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Current Balance
                  </Label>
                  <p className="font-medium">₦500,000</p>
                </div>
              </div>
              <div>
                <Label>New Top up Amount</Label>
                <Input placeholder="Enter amount" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">
                    New Interest Rate
                  </Label>
                  <p className="font-medium">20%</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">
                    New Tenure Duration
                  </Label>
                  <p className="font-medium">3 Years</p>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">
                  New Total Loan
                </Label>
                <p className="font-medium text-green-600">₦700,000</p>
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleTopUpConfirm}
              >
                Confirm Top-up
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
