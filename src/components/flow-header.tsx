"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import Image from "next/image";

export function MainNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="relative h-11 w-[150px]">
            <Image
              src="/logo.png"
              alt="MicroBuilt Logo"
              fill
              sizes="150px"
              loading="eager"
              className="object-contain"
            />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#platform" className="transition-colors hover:text-foreground">
              Platform
            </a>
            <a href="#controls" className="transition-colors hover:text-foreground">
              Controls
            </a>
            <a href="#security" className="transition-colors hover:text-foreground">
              Security
            </a>
          </nav>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/sign-up">Request access</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
