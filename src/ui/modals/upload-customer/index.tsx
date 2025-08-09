import { useState, useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RequestModalContentHeader } from "./content";
import { OnboardCustomerSchema, type OnboardCustomerType } from "./schema";
import UploadCustomerForm from "./form";
import FooterButton from "./mutation";
import { cn } from "@/lib/utils";

export default function UploadNewCustomer() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [checked, setChecked] = useState(false);

  const methods = useForm<OnboardCustomerType>({
    resolver: zodResolver(OnboardCustomerSchema),
    defaultValues: {
      user: {
        email: undefined,
        contact: undefined,
      },
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      methods.reset();
      setSelectedFile(null);
    }
  }, [isOpen, methods]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add Customer</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <FormProvider {...methods}>
          <DialogHeader className="shrink-0">
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <Separator className="bg-[#F0F0F0]" />
          <section className="grid gap-4 sm:gap-5 p-4 sm:p-5 overflow-y-auto flex-1">
            {step <= 6 ? <RequestModalContentHeader step={step} /> : null}
            <Separator className={cn("bg-[#F0F0F0]", step > 6 && "hidden")} />
            {step <= 6 ? (
              <p className="font-normal text-sm text-[#999999]">
                Please meticulously provide the information below and review
                before submitting
              </p>
            ) : null}

            <UploadCustomerForm
              step={step}
              setSelectedFile={setSelectedFile}
              selectedFile={selectedFile}
              checked={checked}
              setChecked={setChecked}
            />

            <Separator className="bg-[#F0F0F0]" />
            <FooterButton
              step={step}
              setStep={setStep}
              checked={checked}
              closeModal={() => setIsOpen(false)}
            />
          </section>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
