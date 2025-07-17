"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useState } from "react";
import AddCommodityModal from "./modal";

interface CommodityListProps {
  commodities: string[];
  onAddCommodity: (name: string) => void;
  onRemoveCommodity: (id: string) => void;
}

export default function CommodityList({
  commodities,
  onAddCommodity,
  onRemoveCommodity,
}: CommodityListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Commodity list
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {commodities.map((commodity) => (
              <Badge
                key={commodity}
                variant="secondary"
                className="flex items-center gap-2 px-3 py-1"
              >
                <span>{commodity}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => onRemoveCommodity(commodity)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <AddCommodityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={onAddCommodity}
      />
    </>
  );
}
