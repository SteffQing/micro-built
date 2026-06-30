"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Download, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { exportList } from "@/lib/mutations/admin/exports";
import { getUser } from "@/lib/queries/user";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type FormData = z.infer<typeof formSchema>;

type ExportFilters = Record<
  string,
  string | number | boolean | Date | undefined | null
>;

interface ExportButtonProps {
  /** Export endpoint, e.g. "/admin/exports/customers". */
  path: string;
  /** Current list filters — forwarded so the export matches the on-screen view. */
  filters?: ExportFilters;
  label?: string;
}

/**
 * "Export to Excel" trigger. Opens a modal to confirm the recipient email
 * (prefilled with the signed-in user's email when they have one — phone-only
 * accounts start blank), then queues the export which the backend emails out.
 */
export function ExportButton({
  path,
  filters = {},
  label = "Export",
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  const { data: userRes } = useQuery(getUser);
  const defaultEmail = userRes?.data?.email ?? "";

  const { mutateAsync, isPending } = useMutation(exportList(path));

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: defaultEmail },
  });

  // Prefill once the cached user resolves / each time the modal is opened.
  useEffect(() => {
    if (open) form.reset({ email: defaultEmail });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultEmail]);

  const onSubmit = async (data: FormData) => {
    await mutateAsync({ ...filters, email: data.email });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Download className="mr-1 h-3 w-3" />
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Export to Excel</DialogTitle>
          <DialogDescription>
            We&apos;ll generate the spreadsheet in the background and email it to
            the address below. It reflects the filters currently applied.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 py-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Where should we send the export?"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="btn-gradient w-full flex-1 rounded-[8px] p-2.5 text-sm font-medium text-white"
              loading={isPending}
            >
              Send Export
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
