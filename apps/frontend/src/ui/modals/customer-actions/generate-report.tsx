"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { generateCustomerReport } from "@/lib/mutations/admin/customer";

export default function GenerateCustomerLoanReport({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  const { mutateAsync, isPending } = useMutation(generateCustomerReport(id));

  const handleClose = () => {
    setOpen(false);
  };

  const onSubmit = async () => {
    await mutateAsync({});
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Generate Report</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Loan Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <p className="text-sm text-muted-foreground">
            Generate a loan report for this customer. The report will be sent to
            the email address on file.
          </p>
          <Button
            onClick={onSubmit}
            className="rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm flex-1 btn-gradient w-full"
            loading={isPending}
          >
            Request Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
