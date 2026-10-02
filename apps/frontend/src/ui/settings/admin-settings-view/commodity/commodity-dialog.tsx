"use client";

import type React from "react";

import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { addCommodity, updateCommodity } from "@/lib/mutations/admin/superadmin";
import { Icon, icons } from "@/components/icon";

export function AddCommodityDialog() {
  const [open, setOpen] = useState(false);
  const [commodity, setCommodity] = useState("");

  const { mutateAsync, isPending } = useMutation(addCommodity);

  function handleOpenChange(open: boolean) {
    setOpen(open);
  }
  async function addNewCommodity() {
    await mutateAsync({ name: commodity });
    setCommodity("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add Commodity</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Commodity</DialogTitle>
        </DialogHeader>

        <Separator className="bg-border" />
        <div className="grid gap-4 p-4 sm:p-5">
          <Input value={commodity} onChange={(e) => setCommodity(e.target.value)} />
          <Separator className="bg-border" />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={addNewCommodity}
            loading={isPending}
            className="rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm flex-1 btn-gradient"
          >
            Add Commodity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ToggleCommodityDialog({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [open, setOpen] = useState(false);

  const mutFn = updateCommodity(id);
  const { mutateAsync, isPending } = useMutation(mutFn);

  function handleOpenChange(open: boolean) {
    setOpen(open);
  }
  async function toggleCommodity() {
    await mutateAsync({ active: !active });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={active ? "hover:bg-destructive hover:text-destructive-foreground" : "hover:bg-success hover:text-success-foreground"}
        >
          {active ? "Deactivate" : "Activate"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{active ? "Deactivate" : "Activate"} Commodity</DialogTitle>
        </DialogHeader>
        <Separator className="bg-border" />
        <div className="grid gap-4 p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to {active ? "deactivate" : "activate"} <strong>{name}</strong>?
            {active && " Inactive commodities are hidden from customers but stay on existing loans."}
          </p>
          <Separator className="bg-border" />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            variant={active ? "destructive" : "default"}
            onClick={toggleCommodity}
            loading={isPending}
            className="rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm flex-1"
          >
            {active ? "Deactivate" : "Activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
