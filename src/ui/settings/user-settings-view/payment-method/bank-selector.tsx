import { Building2, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bank } from "./types";

interface BankSelectorProps {
  banks: Bank[];
  selectedBank: Bank | null;
  onBankSelect: (bank: Bank) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BankSelector({
  banks,
  selectedBank,
  onBankSelect,
  isOpen,
  onOpenChange,
}: BankSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Bank Name</Label>
      <Popover open={isOpen} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between bg-transparent"
          >
            {selectedBank ? (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {selectedBank.name}
              </div>
            ) : (
              <span className="text-muted-foreground">
                Enter your bank name
              </span>
            )}
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search banks..." />
            <CommandList>
              <CommandEmpty>No bank found.</CommandEmpty>
              <CommandGroup>
                {banks.map((bank) => (
                  <CommandItem
                    key={bank.id}
                    value={bank.name}
                    onSelect={() => {
                      onBankSelect(bank);
                      onOpenChange(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        selectedBank?.id === bank.id
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />
                    {bank.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
