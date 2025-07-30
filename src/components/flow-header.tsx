"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import Image from "next/image";

export function MainNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2  w-full py-6 max-w-[100vw]">
      <div className="px-4 lg:px-8 w-full max-w-screen-2xl mx-auto flex items-center gap-2 justify-between">
        <div className="flex items-center gap-8 w-full lg:w-fit sm:justify-between">
          <Link href="/dashboard" className="p-2 relative w-[215px] h-[63px]">
            <Image src="/logo.png" alt="MicroBuilt Logo" fill className="object-contain" />
          </Link>
          <div className="flex items-center gap-3 lg:gap-8 text-background ">
            <Link
              href="/"
              className={cn(
                "transition-colors hover:text-background/80 text-xs lg:text-sm whitespace-nowrap",
                pathname === "/" ? "text-background" : "text-background/80"
              )}
            >
              <span>Home</span>
            </Link>
            <Link
              href="/about"
              className={cn(
                "transition-colors hover:text-background/80 text-xs lg:text-sm whitespace-nowrap",
                pathname?.startsWith("/about") ? "text-background" : "text-background/80"
              )}
            >
              <span>About us</span>
            </Link>
            <Link
              href="/why-choose-us"
              className={cn(
                "transition-colors hover:text-background/80 text-xs lg:text-sm whitespace-nowrap",
                pathname?.startsWith("/why-choose-us") ? "text-background" : "text-background/80"
              )}
            >
              <span>Why Choose us</span>
            </Link>
          </div>
        </div>
        {/*   Desktop RHS NAV Buttons, hidden on mobile */}
        <div className="lg:flex items-center gap-2 hidden">
          <Button variant="outline" className="border-secondary bg-transparent text-white whitespace-nowrap">
            Check Credit Report
          </Button>
          <Button variant="secondary" className="text-white font-normal whitespace-nowrap">
            Loan application
          </Button>
        </div>
      </div>
    </div>
  );
}
