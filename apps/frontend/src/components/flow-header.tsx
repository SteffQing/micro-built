import Link from "next/link";
import { SessionCta } from "./session-cta";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function MainNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <Logo className="h-8 w-auto text-brand" />
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
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SessionCta size="sm" />
        </div>
      </div>
    </header>
  );
}
