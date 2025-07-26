"use client";

import type React from "react";

import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { addComodity, deleteCommodity } from "@/lib/mutations/admin/superadmin";
import { X } from "lucide-react";

export function AddCommodityDialog() {
  const [open, setOpen] = useState(false);
  const [commodity, setCommodity] = useState("");

  const { mutateAsync, isPending } = useMutation(addComodity);

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

        <Separator className="bg-[#F0F0F0]" />
        <div className="grid gap-4 p-4 sm:p-5">
          <Input value={commodity} onChange={(e) => setCommodity(e.target.value)} />
          <Separator className="bg-[#F0F0F0]" />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={addNewCommodity}
            loading={isPending}
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
          >
            Add Commodity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveCommodityDialog({ commodity }: { commodity: string }) {
  const [open, setOpen] = useState(false);

  const { mutateAsync, isPending } = useMutation(deleteCommodity);

  function handleOpenChange(open: boolean) {
    setOpen(open);
  }
  async function removeCommodity() {
    await mutateAsync({ name: commodity });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-4 w-4 " />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Commodity</DialogTitle>
        </DialogHeader>
        <Separator className="bg-[#F0F0F0]" />
        <div className="grid gap-4 p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{commodity}</strong>? This action cannot be undone.
          </p>
          <Separator className="bg-[#F0F0F0]" />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={removeCommodity}
            loading={isPending}
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
          >
            Yes, Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
