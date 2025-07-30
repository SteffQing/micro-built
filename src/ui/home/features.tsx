import { DollarSign, Clock, ShieldCheck } from "lucide-react";

export default function FeaturesSection() {
  return (
    <section className="w-full py-12 md:py-24 lg:py-32 bg-white">
      <div className="px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Why Choose Microbuilt?</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              We offer a seamless and secure lending experience designed to help you achieve your financial aspirations.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-5xl items-start gap-6 py-12 lg:grid-cols-3 lg:gap-12">
          <section className="flex flex-col items-center text-center p-6 bg-background">
            <div className="flex flex-col items-center justify-center gap-2">
              <DollarSign className="h-10 w-10 text-[#B00000]" />
              <h3 className="mt-4">Affordable Rates</h3>
            </div>
            <aside>
              <p className="text-gray-500">
                Competitive interest rates and flexible repayment plans to suit your budget.
              </p>
            </aside>
          </section>
          <section className="flex flex-col items-center text-center p-6 bg-background">
            <div className="flex flex-col items-center justify-center gap-2">
              <Clock className="h-10 w-10 text-[#B00000]" />
              <h3 className="mt-4">Quick Approval</h3>
            </div>
            <aside>
              <p className="text-gray-500">Fast application process and quick disbursement of funds.</p>
            </aside>
          </section>
          <section className="flex flex-col items-center text-center p-6 bg-background">
            <div className="flex flex-col items-center justify-center gap-2">
              <ShieldCheck className="h-10 w-10 text-[#B00000]" />
              <h3 className="mt-4">Secure & Reliable</h3>
            </div>
            <aside>
              <p className="text-gray-500">Your data and transactions are protected with industry-leading security.</p>
            </aside>
          </section>
        </div>
      </div>
    </section>
  );
}
