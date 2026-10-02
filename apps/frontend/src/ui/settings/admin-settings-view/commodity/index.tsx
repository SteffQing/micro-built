"use client";

import { AddCommodityDialog, ToggleCommodityDialog } from "./commodity-dialog";

export default function CommodityList({ commodities }: { commodities: string[] }) {
  return (
    <div className="p-3 lg:p-5">
      <h4 className="mb-3 mt-5 text-sm text-muted-foreground font-normal">Commodity list</h4>
      <div className="flex flex-wrap gap-2 border rounded-xl p-3">
        {commodities.map((commodity, idx) => (
          <div key={commodity} className="flex items-center gap-2 border p-3 rounded-lg">
            <p className="font-normal text-sm">{commodity}</p>
            <ToggleCommodityDialog id={String(idx)} name={commodity} active={true} />
          </div>
        ))}
        <AddCommodityDialog />
      </div>
    </div>
  );
}
