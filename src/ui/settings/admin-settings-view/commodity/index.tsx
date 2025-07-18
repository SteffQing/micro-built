"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useState } from "react";
import AddCommodityModal from "./modal";

export default function CommodityList({
  commodities,
}: {
  commodities: string[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Placeholder function for removing a commodity
  function onRemoveCommodity(commodity: string) {
    // TODO: Implement remove logic
    console.log("Remove commodity:", commodity);
  }

  // Placeholder function for adding a commodity
  function onAddCommodity(commodity: string) {
    // TODO: Implement add logic
    console.log("Add commodity:", commodity);
  }

  return (
    <div className="p-3 lg:p-5">
      <h4 className="mb-3 mt-5 text-sm text-[#666666] font-normal">
        Commodity list
      </h4>
      <div className="flex flex-wrap gap-2 bg-[#FAFAFA] border border-[#F0F0F0] rounded-xl p-3">
        {commodities.map((commodity) => (
          <div
            key={commodity}
            className="flex items-center gap-2 border border-[#F0F0F0] p-3 bg-white rounded-lg"
          >
            <p className="text-[#333333] font-normal text-sm">{commodity}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onRemoveCommodity(commodity)}
            >
              <X className="h-4 w-4 text-[#999999]" />
            </Button>
          </div>
        ))}
        <div
          className="p-3 text-[#8A0806] text-sm font-normal border border-[#FFE1E0] bg-[#FFF0F0] flex gap-2 items-center rounded-lg"
          onClick={() => setIsModalOpen(true)}
        >
          Add
          <Plus className="h-4 w-4 text-[#8A0806]" />
        </div>
      </div>
      <AddCommodityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={onAddCommodity}
      />
    </div>
  );
}
