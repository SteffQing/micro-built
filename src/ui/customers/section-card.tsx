import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { adminCustomersOverviewQueryOption } from "@/lib/queries/admin-customers-overview";

export const AdminCustomerSectionCards = () => {
  const { data, isLoading } = useQuery({
    ...adminCustomersOverviewQueryOption,
  });
  return (
    <div className="grid grid-cols-1 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-4 @5xl/main:grid-cols-4">
      
      <Card className="relative overflow-hidden border-2 border-secondary w-full">
        <div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80"></div>
        <CardContent className="p-4 relative z-10">
          <div className="flex justify-between items-start mb-2">
            <div className="text-3xl font-bold text-primary">
              {data?.data.activeCustomersCount.toLocaleString()}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Active Customers</div>
        </CardContent>
      </Card>

      {/* Customers with Active Loans Card */}
      <Card className="relative overflow-hidden border-2 border-secondary">
        <div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80"></div>
        <CardContent className="p-4 relative z-10">
          <div className="flex justify-between items-start mb-2">
            <div className="text-3xl font-bold text-primary">
              {data?.data.customersWithActiveLoansCount.toLocaleString()}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Customers with Active Loans
          </div>
        </CardContent>
      </Card>

      {/* Defaulters Card */}
      <Card className="relative overflow-hidden border-2 border-secondary">
        <div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80"></div>
        <CardContent className="p-4 relative z-10">
          <div className="flex justify-between items-start mb-2">
            <div className="text-3xl font-bold text-primary">
              {data?.data.defaultedCount.toLocaleString()}
            </div>
            <Button size="sm" variant="secondary" className="">
              See all
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">Defaulters</div>
        </CardContent>
      </Card>

      {/* Repaying on time Card */}
      <Card className="relative overflow-hidden border-2 border-secondary">
        <div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80"></div>
        <CardContent className="p-4 relative z-10">
          <div className="flex justify-between items-start mb-2">
            <div className="text-3xl font-bold text-primary">
              {data?.data.ontimeCount.toLocaleString()}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Repaying on time</div>
        </CardContent>
      </Card>
    </div>
  );
};



