"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NumericalInput } from "@/components/ui/numerical-input";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { liquidationRequest } from "@/lib/mutations/admin/customer";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const liquidationSchema = z.object({
  amount: z.coerce.number().positive("Amount must be a valid positive number"),
  proof: z
    .instanceof(File, { message: "Proof document is required" })
    .refine((file) => file.size <= MAX_FILE_SIZE, "File must be 5 MB or less")
    .refine(
      (file) => ACCEPTED_TYPES.includes(file.type),
      "Only PDF, JPG, and PNG files are accepted",
    ),
});

type LiquidationForm = z.infer<typeof liquidationSchema>;

type Props = {
  userId: string;
  name: string;
  outstanding: number;
  trigger?: ReactNode;
};

export default function LiquidationRequestModal({
  userId,
  name,
  outstanding,
  trigger,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const { isPending, isSuccess, mutateAsync, reset } = useMutation(
    liquidationRequest(userId)
  );

  const form = useForm<LiquidationForm>({
    resolver: zodResolver(liquidationSchema),
    defaultValues: {
      amount: 0,
      proof: undefined as unknown as File,
    },
  });

  const handleOpen = (val: boolean) => {
    setIsOpen(val);
    reset();
    if (!val) {
      form.reset();
      setProofPreview(null);
    }
  };

  function handleProofChange(file: File | undefined) {
    if (!file) {
      setProofPreview(null);
      return;
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setProofPreview(url);
    } else {
      setProofPreview(null);
    }
  }

  async function onSubmit(data: LiquidationForm) {
    await mutateAsync({ amount: data.amount, proof: data.proof });
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="w-full">
            Liquidate
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[450px]">
        {isSuccess ? (
          <>
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-full">
                  <Icon icon={icons.checkCircle} size={20} className="text-success" />
                </div>
                <DialogTitle className="text-lg font-semibold">
                  Liquidation Requested
                </DialogTitle>
              </div>
            </DialogHeader>

            <Separator />

            <section className="grid gap-4 p-4 text-center sm:p-5">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10">
                <Icon icon={icons.checkCircle} size={32} className="text-success" />
              </div>
              <p className="text-sm text-muted-foreground">
                A liquidation request of{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(form.getValues("amount"))}
                </span>{" "}
                for{" "}
                <span className="font-medium text-foreground">{name}</span> has
                been submitted and is pending review.
              </p>
            </section>

            <DialogFooter>
              <Button
                type="button"
                onClick={() => handleOpen(false)}
                className="btn-gradient w-full"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-full">
                  <Icon icon={icons.alertTriangle} size={20} className="text-destructive" />
                </div>
                <DialogTitle className="text-lg font-semibold">
                  Liquidate Loan
                </DialogTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Liquidate loan for{" "}
                <span className="font-medium text-foreground">{name}</span>
              </p>
            </DialogHeader>

            <Separator />

            <Form {...form}>
              <div className="min-w-0">
                <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Total Outstanding</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(outstanding)}
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Liquidation Amount
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <NumericalInput
                              step="0.01"
                              min="0"
                              className="text-lg font-medium"
                              name={field.name}
                              ref={field.ref}
                              onBlur={field.onBlur}
                              value={field.value}
                              onValueChange={field.onChange}
                              emptyOnZero
                              maxDecimals={2}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="proof"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          Proof Document
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              field.onChange(file);
                              handleProofChange(file);
                            }}
                            className="text-sm"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          PDF, JPG, or PNG — max 5 MB
                        </p>
                        <FormMessage />
                        {proofPreview && (
                          <div className="mt-2 rounded-lg border border-border overflow-hidden">
                            <img
                              src={proofPreview}
                              alt="Proof preview"
                              className="max-h-40 w-auto object-contain"
                            />
                          </div>
                        )}
                        {field.value &&
                          !field.value.type?.startsWith("image/") && (
                            <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted p-3">
                              <Icon
                                icon={icons.file}
                                size={18}
                                className="text-muted-foreground"
                              />
                              <span className="min-w-0 text-sm text-muted-foreground truncate">
                                {field.value.name}
                              </span>
                            </div>
                          )}
                      </FormItem>
                    )}
                  />
                </section>{" "}
              </div>
            </Form>

            <DialogFooter>
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpen(false)}
                  disabled={isPending}
                  className="w-full"
                >
                  Cancel
                </Button>
                <Button
                  onClick={form.handleSubmit(onSubmit)}
                  loading={isPending}
                  className="btn-gradient w-full"
                >
                  Request Liquidation
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
