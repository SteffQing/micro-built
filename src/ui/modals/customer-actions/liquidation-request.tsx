"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, DollarSign } from "lucide-react";
import { liquidationRequest } from "@/lib/mutations/admin/customer";
import { formatCurrency } from "@/lib/utils";

const liquidationSchema = z.object({
  amount: z.coerce.number().positive("Amount must be a valid positive number"),
});

type LiquidationForm = z.infer<typeof liquidationSchema>;

type Props = {
  userId: string;
  name: string;
  totalBorrowed: number;
};

export default function LiquidationRequestModal({ userId, name, totalBorrowed }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const { isPending, mutateAsync } = useMutation(liquidationRequest(userId));

  const form = useForm<LiquidationForm>({
    resolver: zodResolver(liquidationSchema),
    defaultValues: {
      amount: totalBorrowed,
    },
  });

  const handleOpen = (val: boolean) => {
    setIsOpen(val);
    if (!val) {
      form.reset();
    }
  };

  async function onSubmit(data: LiquidationForm) {
    await mutateAsync(data);
    setIsOpen(false);
  }

  const watchedAmount = form.watch("amount");

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Liquidate
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[450px] rounded-lg">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-full">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-semibold">Liquidate Loan</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Liquidate loan for <span className="font-medium text-foreground">{name}</span>
          </p>
        </DialogHeader>

        <Separator className="bg-[#F0F0F0]" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>Total Outstanding</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalBorrowed)}</p>
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Liquidation Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-10 text-lg font-medium"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {watchedAmount && (
                      <p className="text-xs text-muted-foreground">
                        Liquidating: {formatCurrency(Number(watchedAmount) || 0)}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </section>{" "}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpen(false)}
                disabled={isPending}
                className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isPending}
                className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
              >
                Request Liquidation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
