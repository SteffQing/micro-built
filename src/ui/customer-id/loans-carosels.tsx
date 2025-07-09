"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Banknote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// import { X } from "lucide-react";
import { Plus, RefreshCw } from "lucide-react";
import type { Loan } from "./dummy-data";
import { useQuery } from "@tanstack/react-query";
import {
  adminCustomerLoansDetailsByIdQueryOptions,
  AdminCustomersByIdResponse,
} from "@/lib/queries/admin-customer-by-id";

interface LoanDetailsDialogProps {
  loan: UnifiedLoan;
  onAddTopUp: () => void;
  onRestructure: () => void;
}
type CustomerProfileProps = {
  customer: AdminCustomersByIdResponse["data"];
};

type UnifiedLoan = {
  id: string;
  amount: number;
  loanTenure?: number;
  amountRepaid?: number;
  balance?: number;
  category?: string;
  date?: string;
  status: 'active' | 'pending';
};

export function LoansCarousel({ customer }: CustomerProfileProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  // const [selectedLoan, setSelectedLoan] = React.useState<Loan | null>(null);
  console.log({ isDialogOpen });
  const onAddTopUp = () => {
    console.log("Add Top Up - Coming soon");
    setIsDialogOpen(false);
  };

  const onRestructure = () => {
    console.log("Restructure - Coming soon");
    setIsDialogOpen(false);
  };

  const { data: loanSummary } = useQuery(
    adminCustomerLoansDetailsByIdQueryOptions({ id: customer.id })
  );

 const activeLoans = loanSummary?.data?.activeLoans || [];
  const pendingLoans = loanSummary?.data?.pendingLoans || [];
  
  // Transform loans to unified format
  const unifiedActiveLoans: UnifiedLoan[] = activeLoans.map(loan => ({
    ...loan,
    status: 'active' as const
  }));
  
  const unifiedPendingLoans: UnifiedLoan[] = pendingLoans.map(loan => ({
    ...loan,
    status: 'pending' as const
  }));
  
  const allLoans = [...unifiedActiveLoans, ...unifiedPendingLoans];
  return (
    <Card className="">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">
              Active Loans
            </CardTitle>
            <Badge className="bg-primary rounded-full text-white">
              {[...activeLoans, ...pendingLoans]?.length || 0}
            </Badge>
          </div>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Carousel
          opts={{
            align: "start",
          }}
          className="w-full "
        >
          <CarouselContent>
            {allLoans.map((loan) => (
              <CarouselItem
                key={loan.id}
                className="basis-1 md:basis-1/2 lg:basis-1/2"
              >
                <div className="p-1">
                  <Card key={loan.id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Banknote className="w-4 h-4 text-primary" />
                        <span className="font-medium text-primary">
                          {loan.id}
                        </span>
                        <Badge 
                          variant={loan.status === 'active' ? 'default' : 'secondary'}
                          className="ml-auto"
                        >
                          {loan.status}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Loan Amount
                          </span>
                          <span className="font-medium">{loan.amount}</span>
                        </div>
                        
                        {loan.status === 'active' ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Tenure
                              </span>
                              <span className="font-medium text-primary">
                                {loan.loanTenure}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Repaid Amount
                              </span>
                              <span className="font-medium">
                                {loan.amountRepaid}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Balance
                              </span>
                              <span className="font-medium">{loan.balance}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Category
                              </span>
                              <span className="font-medium text-primary">
                                {loan.category}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Date
                              </span>
                              <span className="font-medium">
                                {loan.date}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <LoanDetailsDialog
                        loan={loan}
                        onAddTopUp={onAddTopUp}
                        onRestructure={onRestructure}
                      />
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </CardContent>
    </Card>
  );
}

function LoanDetailsDialog({
  loan,
  onAddTopUp,
  onRestructure,
}: LoanDetailsDialogProps) {
  return (
   <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full mt-4 text-primary border-secondary hover:bg-green-50"
        >
          See Loan Details
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-lg shadow-lg p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            Loan Details - {loan.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Loan ID</span>
            <span className="font-medium">{loan.id}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Loan Amount</span>
            <span className="font-medium">{loan.amount}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge className="bg-secondary text-primary hover:bg-secondary">
              {loan.status}
            </Badge>
          </div>

          {loan.status === 'active' ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Loan Tenure</span>
                <span className="font-medium text-green-600">{loan.loanTenure}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Amount Repaid</span>
                <span className="font-medium">{loan.amountRepaid}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Balance Remaining
                </span>
                <span className="font-medium">{loan.balance}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Category</span>
                <span className="font-medium text-green-600">{loan.category}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="font-medium">{loan.date}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={onAddTopUp}
            className="flex-1 bg-green-700 hover:bg-green-800 text-white"
            disabled={loan.status === 'pending'}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Top-Up
          </Button>
          <Button
            onClick={onRestructure}
            variant="outline"
            className="flex-1 text-green-700 border-green-200 hover:bg-green-50"
            disabled={loan.status === 'pending'}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Restructure Loan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
