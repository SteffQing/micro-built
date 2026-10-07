import Link from "next/link";
import { SessionCta } from "./session-cta";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const links = [
  ["Loans", "/#loans"],
  ["Estimate", "/#estimate"],
  ["How it works", "/#how-it-works"],
  ["Security", "/#security"],
  ["FAQ", "/#faq"],
];

export function MainNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <Logo className="h-8 w-auto text-brand" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            {links.map(([label, href]) => (
              <a key={href} href={href} className="transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SessionCta size="sm" />
        </div>
      </div>
    </header>
  );
}
