"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { allCommodities } from "@/lib/queries/admin/commodities";
import { createCommodity, toggleCommodity } from "@/lib/mutations/admin/commodities";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import PageTitle from "@/components/page-title";
import { formatDate } from "@/lib/utils";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import Link from "next/link";

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function CommoditiesPage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const { data, isLoading } = useQuery(allCommodities);
  const createMut = useMutation(createCommodity);
  const toggleMut = useMutation(toggleCommodity);

  const filtered = (data ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAddError(null);
    try {
      await createMut.mutateAsync({ name: newName.trim() });
      setNewName("");
      setAddOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to add commodity";
      setAddError(msg);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await toggleMut.mutateAsync({ id, active: !active });
    } catch {
      // Error handled by toast in mutation
    }
  };

  return (
    <div className="p-3 lg:p-5 space-y-3 lg:space-y-5">
      <PageTitle
        title="Commodities"
        actionContent={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gradient">
                <Icon icon={icons.plus} size={16} className="mr-1" />
                Add Commodity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Commodity</DialogTitle>
              </DialogHeader>
              <Separator />
              <div className="grid gap-4 p-4 sm:p-5">
                <div className="space-y-2">
                  <Label htmlFor="commodity-name">Name</Label>
                  <Input
                    id="commodity-name"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setAddError(null);
                    }}
                    placeholder="e.g. Rice, Laptop, Generator"
                  />
                  {newName.trim() && (
                    <p className="text-xs text-muted-foreground">
                      Preview:{" "}
                      <span className="font-medium text-foreground">
                        {toTitleCase(newName.trim())}
                      </span>
                    </p>
                  )}
                  {addError && (
                    <p className="text-xs text-destructive">{addError}</p>
                  )}
                </div>
                <Separator />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddOpen(false);
                    setNewName("");
                    setAddError(null);
                  }}
                  disabled={createMut.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  loading={createMut.isPending}
                  disabled={!newName.trim()}
                  className="btn-gradient"
                >
                  Add Commodity
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="bg-background rounded-xl border gap-0">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <h2 className="text-lg font-semibold">All Commodities</h2>
            <p className="text-xs text-muted-foreground">
              Manage commodity items available for asset loans
            </p>
          </div>
          <div className="relative max-w-sm w-full">
            <Icon
              icon={icons.search}
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search commodities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium text-sm text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="font-medium text-sm text-muted-foreground">
                  Active
                </TableHead>
                <TableHead className="font-medium text-sm text-muted-foreground">
                  Created
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingSkeleton columns={3} rows={5} />
              ) : filtered.length === 0 ? (
                <TableEmptyState
                  colSpan={3}
                  title="No commodities found"
                  description={
                    search
                      ? "No commodities match your search."
                      : "No commodities have been added yet."
                  }
                />
              ) : (
                filtered.map((commodity) => (
                  <TableRow key={commodity.id}>
                    <TableCell className="font-medium">
                      {commodity.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={commodity.active}
                          onCheckedChange={() =>
                            handleToggle(commodity.id, commodity.active)
                          }
                          disabled={toggleMut.isPending}
                          aria-label={`Toggle ${commodity.name}`}
                        />
                        <span
                          className={
                            commodity.active
                              ? "text-xs text-success"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {commodity.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {commodity.createdAt
                        ? new Date(commodity.createdAt).toLocaleDateString(
                            "en-US",
                            { day: "numeric", month: "short", year: "numeric" }
                          )
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
