"use client";

import type React from "react";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AxiosError } from "axios";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  commodityname: z
    .string()
    .min(5)
    .max(50, { message: "name must be greater than 5" }),
});

export function AddCommodityDialog() {
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      commodityname: "",
    },
  });

  const { mutateAsync, isPending, reset, error } = useMutation({
    mutationFn: async (commodity: string) => {
      const response = await api.post("/admin/commodities", {
        name: commodity,
      });
      return response.data;
    },
    onSuccess: () => {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["admin-configs"] });
      form.reset();
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutateAsync(values.commodityname).then(() => {
      form.reset();
    });
  }

  function handleOpenChange(open: boolean) {
    setOpen(open);
    setShowSuccess(false);
    reset();
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add Commodity</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {showSuccess ? (
          <div className="w-full h-full items-center justify-center flex">
            <div className="py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Commodity has been added successfully
              </p>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  {(error instanceof AxiosError &&
                    error?.response?.data?.message) ||
                    "Failed to add commodity"}
                </AlertDescription>
              </Alert>
            )}
            <DialogHeader>
              <DialogTitle>Add New Commodity</DialogTitle>
            </DialogHeader>
            <Separator />
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <FormField
                  control={form.control}
                  name="commodityname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commodity Name</FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending}
                  variant={isPending ? "secondary" : "default"}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" /> is
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
