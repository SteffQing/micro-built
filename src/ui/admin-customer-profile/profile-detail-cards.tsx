"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Phone } from "lucide-react";
import type { CustomerProfile } from "./dummy-data";
import { Icons } from "@/components/icons";
import { Separator } from "@/components/ui/separator";

interface CustomerProfileProps {
  customer: CustomerProfile;
}

export function CustomerProfileCard({ customer }: CustomerProfileProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-3">
        <div className="space-y-2 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 py-4">
            <Avatar className="w-16 h-16">
              <AvatarImage
                src={customer.avatar || "/woman.jpeg"}
                alt={customer.name}
              />
              <AvatarFallback className="bg-blue-100 text-blue-700 text-lg">
                {customer.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              {" "}
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-semibold text-gray-900">
                  {customer.name}
                </h1>
                {customer.isVerified && <Icons.verified className="w-5 h-5" />}
              </div>
              <p className="text-sm text-primary">{customer.id}</p>
            </div>
          </div>
          <Separator />

          <div className="flex items-end justify-between py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{customer.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span className="text-sm">{customer.phone}</span>
              </div>
            </div>
            <Badge className="bg-secondary text-secondary-foreground">
              {customer.status}
            </Badge>
          </div>
          <Separator />
        </div>
      </CardContent>
    </Card>
  );
}

interface LoanSummaryProps {
  customer: CustomerProfile;
}

export function LoanSummary({ customer }: LoanSummaryProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Loan Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative space-y-2 rounded-xl  border-r-2 border-b-2 border-secondary p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>
              {customer.totalLoans}
            </p>
            <p className="text-sm  text-muted-foreground">Total Loans</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-l-2 border-b-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>
              {customer.totalLoans}
            </p>
            <p className="text-sm text-muted-foreground">Total Loans</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-r-2 border-t-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>
              {customer.totalLoans}
            </p>
            <p className="text-sm text-muted-foreground">Total Loans</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-l-2 border-t-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>
              {customer.totalLoans}
            </p>
            <p className="text-sm text-muted-foreground">Total Loans</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
