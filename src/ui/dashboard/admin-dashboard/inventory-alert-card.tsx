"use client";

import { Bell, ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const inventoryItems = [
  {
    name: "Samsung Galaxy A14",
    quantity: 9,
  },
  {
    name: "HP Laptop 245 G7",
    quantity: 4,
  },
  {
    name: "MIFI Router ZTE",
    quantity: 2,
  },
  {
    name: "iPhone 15 Pro max",
    quantity: 2,
  },
  {
    name: "iPhone 15 Pro max",
    quantity: 2,
  },
];

export default function InventoryAlertsCard() {
  const itemsBelowThreshold = inventoryItems.filter(
    (item) => item.quantity <= 5
  ).length;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          Low Inventory Alerts
          <Bell className="h-4 w-4" />
        </CardTitle>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <AlertTriangle className="h-4 w-4" />
            <span>{itemsBelowThreshold} Items below reorder threshold</span>
          </div>

          <div className="space-y-3">
            {inventoryItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-gray-400" />
                  <span className="text-sm text-muted-foreground">
                    {item.name}
                  </span>
                </div>
                <span className="text-sm font-medium">
                  {item.quantity} Left
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
