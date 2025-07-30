import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative w-full py-12 md:py-24 lg:py-32 bg-gray-100">
      <div className=" grid items-center gap-6 px-4 md:grid-cols-2 md:px-6 lg:gap-10">
        <div className="space-y-4 text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
            Let&apos;s Bring Your Financial Goals to Life
          </h1>
          <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            Access affordable loans anytime, anywhere with Microbuilt. We provide flexible financial solutions tailored
            to your needs.
          </p>
          <Button className="mx-auto md:mx-0">
            <Link href="/sign-up">Get Started Now</Link>
          </Button>
        </div>
        <div className="relative h-[300px] w-full md:h-[400px] lg:h-[500px]">
          <Image
            src="/loan_application.png?height=500&width=700"
            alt="Loan Application"
            layout="fill"
            objectFit="contain"
            // className="rounded-lg shadow-lg"
          />
        </div>
      </div>
    </section>
  );
}
