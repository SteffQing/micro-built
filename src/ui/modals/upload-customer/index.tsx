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
import {
  RequestModalContent,
  RequestModalContentConfirmation,
  RequestModalContentHeader,
  RequestModalContentSuccess,
} from "./content";
import RequestModalContentFooter from "./mutation";
import { OnboardCustomerSchema, type OnboardCustomerType } from "./schema";
import { toast } from "sonner";
import UploadCustomerForm from "./form";
import FooterButton from "./mutation";

export default function UploadNewCustomer() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const methods = useForm<OnboardCustomerType>({
    resolver: zodResolver(OnboardCustomerSchema),
  });

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      methods.reset();
      setSelectedFile(null);
    }
  }, [isOpen, methods]);

  const onSubmit = (data: OnboardCustomerType) => {
    console.log("Submitting customer:", data);
    toast.success("Customer submitted successfully!");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add Customer</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <FormProvider {...methods}>
          {/* <form onSubmit={methods.handleSubmit(onSubmit)}> */}
          <DialogHeader className="shrink-0">
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <Separator className="bg-[#F0F0F0]" />
          <section className="grid gap-4 sm:gap-5 p-4 sm:p-5 overflow-y-auto flex-1">
            {step <= 6 ? <RequestModalContentHeader step={step} /> : null}
            <Separator className="bg-[#F0F0F0]" />
            {step <= 6 ? (
              <>
                <p className="font-normal text-sm text-[#999999]">
                  Please meticulously provide the information below and review
                  before submitting
                </p>
                <UploadCustomerForm
                  step={step}
                  setSelectedFile={setSelectedFile}
                  selectedFile={selectedFile}
                />
              </>
            ) : null}

            <Separator className="bg-[#F0F0F0]" />
            <FooterButton
              step={step}
              setStep={setStep}
              closeModal={() => setIsOpen(false)}
            />
          </section>
          {/* </form> */}
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
