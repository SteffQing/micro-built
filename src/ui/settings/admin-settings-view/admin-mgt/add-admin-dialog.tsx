"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Email is required"),
});
export function AddNewAdminDialog() {
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const { mutateAsync, isPending, reset, error } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const response = await api.post("/admin/invite", values);
      if (response.data.success === false || response.data.error) {
        throw new Error(response.data.message || "Failed to add admin");
      }
      return response.data;
    },
    onSuccess: () => {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      form.reset();
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutateAsync(values).then(() => {
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
      <form>
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-3 h-3 mr-1" /> Add New Admin
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          {showSuccess ? (
            <div className="w-full h-full items-center justify-center flex">
              <div className="py-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  The admin invitation has been sent successfully!
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
                      "Failed to add admin"}
                  </AlertDescription>
                </Alert>
              )}
              <DialogHeader>
                <DialogTitle>Add New Admin</DialogTitle>
              </DialogHeader>
              <Separator />
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="full name" {...field} />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="admin@microbuilt.com"
                            {...field}
                          />
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
      </form>
    </Dialog>
  );
}
