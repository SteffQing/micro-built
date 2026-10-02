"use client";

import { Icon, icons } from "@/components/icon";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TableToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: { label: string; value: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-64">
          <Icon icon={icons.search} size={16} className="pointer-events-none absolute inset-y-0 left-3 my-auto text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search"
            aria-label="Search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 rounded-lg border-border bg-muted pl-9 text-sm"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-9 gap-1.5 border-border text-sm font-normal text-muted-foreground hover:text-muted-foreground"
            >
              Filter
              <Icon icon={icons.listFilter} size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={status}
              onValueChange={onStatusChange}
            >
              <DropdownMenuRadioItem value="all">
                All statuses
              </DropdownMenuRadioItem>
              {statusOptions.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {children}
    </div>
  );
}
