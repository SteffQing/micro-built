"use client";

import type React from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { requestVariationSchedule } from "@/lib/mutations/admin/repayments";

export default function RequestVariationSchedule() {
  const [period, setPeriod] = useState<string>("");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  const { mutateAsync, isPending, reset, isSuccess } = useMutation(
    requestVariationSchedule
  );

  const handleReset = () => {
    setEmail("");
    setPeriod("");
    reset();
  };

  const handleSubmit = async () => {
    await mutateAsync({ email, period });

    if (isSuccess) {
      handleReset();
      setOpen(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) handleReset();
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="btn-gradient">
          Schedule Variation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80dvh] overflow-y-auto py-3 px-4">
        <DialogHeader>
          <DialogTitle className="">
            Generate Repayment Schedule Variation
          </DialogTitle>
        </DialogHeader>

        <section className="space-y-6">
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-medium">Repayment Period</Label>
            <Input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="APRIL 2025"
            />
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter an email address to receive the report"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient w-full"
              loading={isPending}
              disabled={!period || !email || isPending}
            >
              Generate Report
            </Button>
          </DialogFooter>
        </section>
      </DialogContent>
    </Dialog>
  );
}
