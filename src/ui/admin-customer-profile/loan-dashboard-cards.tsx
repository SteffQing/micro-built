"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { MessageSquare, Ban, MoreHorizontal } from "lucide-react";
import { Icons } from "@/components/icons";

// Types
interface LoanApplication {
  id: string;
  type: "Mortgage" | "Education" | "Personal" | "Business";
  applicationNumber: string;
  amount: number;
  date: string;
  status: "Pending" | "Approved" | "Rejected" | "Under Review";
}

// interface DefaultedLoanData {
//   hasDefaulted: boolean;
//   message: string;
// }

interface AdminAction {
  icon: React.ReactNode;
  label: string;
  action: () => void;
}

// Sample data
export const sampleApplications: LoanApplication[] = [
  {
    id: "1",
    type: "Mortgage",
    applicationNumber: "#6546926",
    amount: 150000,
    date: "13 Feb, 2025",
    status: "Pending",
  },
  {
    id: "2",
    type: "Education",
    applicationNumber: "#6546927",
    amount: 75000,
    date: "12 Feb, 2025",
    status: "Under Review",
  },
  {
    id: "3",
    type: "Personal",
    applicationNumber: "#6546928",
    amount: 25000,
    date: "11 Feb, 2025",
    status: "Pending",
  },
];

// Utility functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    case "under review":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export const DefaultedLoansCard: React.FC = () => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Defaulted Loans</CardTitle>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Icons.person_available className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground   max-w-xs">
            This customer has not defaulted on any loans
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
export const AdminActionCard: React.FC = () => {
  const adminActions: AdminAction[] = [
    {
      icon: <MessageSquare className="h-4 w-4" />,
      label: "Send Message",
      action: () => console.log("Send message clicked"),
    },
    {
      icon: <Ban className="h-4 w-4" />,
      label: "Suspend Account",
      action: () => console.log("Suspend account clicked"),
    },
  ];

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">
          <h3 className="">Admin Actions</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {adminActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start h-auto py-3 px-3 text-left"
              onClick={action.action}
            >
              <span className="mr-3 text-muted-foreground">{action.icon}</span>
              <span className="text-sm text-muted-foreground">
                {action.label}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

interface PendingApplicationsCardProps {
  applications?: LoanApplication[];
  onApplicationClick?: (application: LoanApplication) => void;
}

export const PendingApplicationsCard: React.FC<
  PendingApplicationsCardProps
> = ({
  applications = sampleApplications,
  onApplicationClick = (app) => console.log("Application clicked:", app),
}) => {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold">
          Pending Applications
        </CardTitle>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <Carousel className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {applications.map((application) => (
              <CarouselItem
                key={application.id}
                className="pl-2 md:pl-4 basis-10/11"
              >
                <Card
                  className="cursor-pointer transition-all hover:shadow-md border-2 hover:border-primary/20"
                  onClick={() => onApplicationClick(application)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="h-1.5 w-4 rounded-full bg-yellow-400" />
                          <div className="h-1.5 w-4 rounded-full bg-green-400" />
                          <div className="h-1.5 w-4 rounded-full bg-red-400" />
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={getStatusColor(application.status)}
                      >
                        {application.status}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-semibold text-gray-900">
                        {application.type}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {application.applicationNumber}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="text-xl font-bold text-green-600">
                        {formatCurrency(application.amount)}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-1 w-1 rounded-full bg-green-500" />
                        <span className="text-xs text-gray-500">
                          {application.date}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex" />
          <CarouselNext className="hidden md:flex" />
        </Carousel>
      </CardContent>
    </Card>
  );
};




