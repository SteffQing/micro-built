import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AdminCustomerSectionCards = () => {
  return (
    <div className="grid grid-cols-1 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3 @5xl/main:grid-cols-5">
      {metrics.map((metric, index) => (
        <Card
          key={index}
          className="relative overflow-hidden border-2 border-secondary"
        >
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-secondary rounded-tl-full opacity-80"></div>

          <CardContent className="p-4 relative z-10">
            <div className="flex justify-between items-start mb-2">
              <div className="text-3xl font-bold text-primary">
                {metric.value}
              </div>
              {metric.showSeeAll && (
                <Button size="sm" variant="secondary" className="">
                  See all
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{metric.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const metrics = [
  {
    value: "1,245",
    label: "Total Customers",
    showSeeAll: false,
  },
  {
    value: "840",
    label: "Active Customers",
    showSeeAll: false,
  },
  {
    value: "120",
    label: "Defaulters",
    showSeeAll: true,
  },
  {
    value: "300",
    label: "Repaying on time",
    showSeeAll: false,
  },
  {
    value: "40",
    label: "Flagged with Issues",
    showSeeAll: false,
  },
];
