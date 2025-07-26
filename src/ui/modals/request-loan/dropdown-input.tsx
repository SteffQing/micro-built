import type { Dispatch, SetStateAction } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getCommodities } from "@/lib/queries/config";
import { Input } from "@/components/ui/input";

export interface CommodityDropdownProps {
  commodity: string;
  setCommodity: Dispatch<SetStateAction<string>>;
}

export function CommodityDropdown({ commodity, setCommodity }: CommodityDropdownProps) {
  const { data, isLoading } = useQuery(getCommodities);

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">Loan Item</Label>
      <Select onValueChange={(value) => setCommodity(value)} disabled={isLoading} defaultValue={commodity}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select Asset" />
        </SelectTrigger>
        <SelectContent>
          {data?.data ? (
            data.data.map((asset) => <SelectItem value={asset}>{asset}</SelectItem>)
          ) : (
            <span>Loading available assets...</span>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface CashInputProps {
  amount: number;
  setAmount: Dispatch<SetStateAction<number>>;
}

export function CashInput({ amount, setAmount }: CashInputProps) {
  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">Loan Amount</Label>
      <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
    </div>
  );
}
