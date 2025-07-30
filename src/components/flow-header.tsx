"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import Image from "next/image";

export function MainNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="p-2 relative w-[215px] h-[63px]">
            <Image src="/logo.png" alt="MicroBuilt Logo" fill className="object-contain" />
          </Link>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <Link href="/login">Sign In</Link>
          </Button>
          {/* <Button size="sm" className="hidden sm:flex">
            <Link href="/signup">Sign Up</Link>
          </Button> */}
        </div>
      </div>
    </header>
  );
}
