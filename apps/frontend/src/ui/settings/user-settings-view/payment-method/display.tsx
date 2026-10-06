"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePaymentMethod } from "@/lib/mutations/user";
import { PendingChangeNotice } from "@/ui/change-requests/pending-change-notice";
import { RecentChanges } from "@/ui/change-requests/recent-changes";

const schema = z.object({
  bankName: z.string().trim().min(1, "Enter the bank's name"),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
  accountName: z.string().trim().min(1, "Enter the name on the account"),
  bvn: z.union([z.literal(""), z.string().regex(/^\d{11}$/, "BVN must be 11 digits")]),
});

type Values = z.infer<typeof schema>;

// The customer's bank account. A change isn't applied straight away: it waits for an
// admin's approval, and the account shown stays the live one until then.
export default function PaymentMethodDisplay({ bankName, accountNumber, accountName }: UserPaymentMethodDto) {
  const [editing, setEditing] = useState(false);
  const { mutate, isPending } = useMutation(updatePaymentMethod);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { bankName, accountNumber, accountName, bvn: "" },
  });

  function onSubmit({ bvn, ...rest }: Values) {
    mutate(
      { ...rest, ...(bvn && { bvn }) },
      {
        onSuccess: () => {
          // The change waits for approval: the next edit starts from the live account again.
          form.reset();
          setEditing(false);
        },
      },
    );
  }

  function toggle() {
    if (editing) form.reset();
    setEditing(!editing);
  }

  return (
    <div className="max-w-4xl">
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Payment Method</h2>
          <Button variant={editing ? "ghost" : "outline"} size="sm" onClick={toggle} disabled={isPending}>
            <Icon icon={editing ? icons.x : icons.edit} size={16} />
            {editing ? "Cancel" : "Change bank details"}
          </Button>
        </div>

        <PendingChangeNotice kind="PAYMENT_METHOD" />
        <RecentChanges kind="PAYMENT_METHOD" />

        <div className="rounded-lg border p-6">
          {editing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="numeric" maxLength={10} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                        <FormDescription>It must match the name on your MicroBuilt account.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bvn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BVN</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="numeric" maxLength={11} autoComplete="off" />
                        </FormControl>
                        <FormDescription>Only if your BVN has changed; leave it empty otherwise.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    An admin reviews the change before it replaces your current account.
                  </p>
                  <Button type="submit" loading={isPending}>
                    Send for approval
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Icon icon={icons.building} size={20} className="text-warning" />
                </div>
                <span className="min-w-0 font-medium wrap-anywhere">{bankName}</span>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayAccountName">Account Name</Label>
                  <Input id="displayAccountName" value={accountName} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayAccountNumber">Account Number</Label>
                  <Input id="displayAccountNumber" value={accountNumber} readOnly className="bg-muted" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
