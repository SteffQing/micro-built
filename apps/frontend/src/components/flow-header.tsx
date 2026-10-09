import Link from "next/link";
import { Icon, icons } from "./icon";
import { Logo } from "./logo";
import { SessionCta } from "./session-cta";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

const links = [
  ["Loans", "/#loans"],
  ["Estimate", "/#estimate"],
  ["How it works", "/#how-it-works"],
  ["Security", "/#security"],
  ["FAQ", "/#faq"],
];
/** The menu has room for one more. */
const menuLinks = [...links, ["Help & support", "/support"]];

/** Phones and small tablets: the page's links and the session buttons in a panel from the right. */
function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Icon icon={icons.menu} size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)] gap-0 p-0">
        <SheetHeader className="border-b px-5 py-4">
          <Logo aria-hidden className="h-7 w-auto self-start text-brand" />
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Pages and sign in</SheetDescription>
        </SheetHeader>
        <nav aria-label="Main" className="grid gap-1 p-3">
          {menuLinks.map(([label, href]) => (
            <SheetClose asChild key={href}>
              <a
                href={href}
                className="rounded-md px-3 py-2.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {label}
              </a>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 border-t p-5">
          <SessionCta signInLabel="Sign in" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MainNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-8">
          <Link href="/" className="shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
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
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {/* On phones the session buttons live in the menu: there is no room for them beside the logo. */}
          <div className="hidden items-center gap-2 sm:flex">
            <SessionCta size="sm" />
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
