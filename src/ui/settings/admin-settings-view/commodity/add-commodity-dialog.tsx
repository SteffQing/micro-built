"use client";

import type React from "react";

import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import z from "zod";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { addComodity } from "@/lib/mutations/admin/superadmin";

export function AddCommodityDialog() {
  const [open, setOpen] = useState(false);
  const [commodity, setCommodity] = useState("");

  const { mutateAsync, isPending } = useMutation(addComodity);

  function handleOpenChange(open: boolean) {
    setOpen(open);
  }

  async function addNewCommodity() {
    await mutateAsync({ name: commodity });
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
        </div>
        <Separator className="bg-[#F0F0F0]" />

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
