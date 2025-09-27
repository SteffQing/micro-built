"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  OnboardCustomerSchema,
  type OnboardCustomerType,
} from "@/ui/add-customer/schema";
import { RequestModalContentHeader } from "@/ui/add-customer/step-header";
import UploadCustomerForm from "@/ui/add-customer";
import FooterButton from "@/ui/add-customer/footer-buttons";

export default function CustomerOnboardingPage() {
  const [step, setStep] = useState(1);
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

  const resetForm = () => {
    setStep(1);
    methods.reset();
    setChecked(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <FormProvider {...methods}>
        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Progress Header */}
            {step <= 6 && (
              <div className="px-6 py-8 bg-slate-50 border-b border-slate-200">
                <RequestModalContentHeader step={step} />
              </div>
            )}

            {/* Form Content */}
            <div className="p-6 sm:p-8">
              {step <= 6 && (
                <div className="mb-6">
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Please meticulously provide the information below and review
                    before submitting
                  </p>
                </div>
              )}

              <div className="space-y-6">
                <UploadCustomerForm
                  step={step}
                  checked={checked}
                  setChecked={setChecked}
                />
              </div>

              {/* Footer Actions */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <FooterButton
                  step={step}
                  setStep={setStep}
                  checked={checked}
                  closeModal={resetForm}
                />
              </div>
            </div>
          </div>
        </main>
      </FormProvider>
    </div>
  );
}
