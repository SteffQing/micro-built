"use client";

import { useState, type JSX } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { messageCustomer } from "@/lib/mutations/admin/customer";

const sendMessageSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be 100 characters or less"),
  message: z.string().min(1, "Message is required").max(1000, "Message must be 1000 characters or less"),
});

type SendMessageForm = z.infer<typeof sendMessageSchema>;

type Props = {
  userId: string;
  name: string;
  trigger: JSX.Element;
};

export function AdminMessageUserModal({ userId, name, trigger }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { isPending, mutateAsync } = useMutation(messageCustomer(userId));

  const form = useForm<SendMessageForm>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: {
      title: "",
      message: "",
    },
  });

  const handleOpen = (val: boolean) => {
    setIsOpen(val);
    if (!val) {
      form.reset();
    }
  };

  async function onSubmit(data: SendMessageForm) {
    await mutateAsync(data);
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Message {name}, InApp</DialogTitle>
        </DialogHeader>

        <Separator className="bg-[#F0F0F0]" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter message title..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter your message..." className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpen(false)}
                disabled={isPending}
                className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
              >
                Cancel
              </Button>
              <Button
                className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
                type="submit"
                loading={isPending}
              >
                Send Message
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
