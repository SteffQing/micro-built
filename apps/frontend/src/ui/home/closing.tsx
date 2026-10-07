import Link from "next/link";
import { Logo } from "@/components/logo";
import { SessionCta } from "@/components/session-cta";
import { BrandMosaic } from "./brand-mosaic";

export function ClosingCta() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand text-brand-foreground">
        <BrandMosaic className="absolute inset-0 -z-10 h-full opacity-40" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand via-brand/90 to-brand/30" />
        <div className="max-w-xl px-6 py-14 sm:px-12 sm:py-20">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Your next loan is a few minutes away
          </h2>
          <p className="mt-4 text-lg leading-8 text-brand-foreground/85">
            Create your account, add your work details and send your first request today.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SessionCta signInLabel="Sign in" tone="inverse" />
          </div>
        </div>
      </div>
    </section>
  );
}

const footerLinks = [
  {
    title: "Loans",
    links: [
      ["Cash loans", "/#loans"],
      ["Asset financing", "/#loans"],
      ["Repayment estimate", "/#estimate"],
    ],
  },
  {
    title: "Company",
    links: [
      ["How it works", "/#how-it-works"],
      ["Security", "/#security"],
      ["FAQ", "/#faq"],
    ],
  },
  {
    title: "Account",
    links: [
      ["Sign in", "/login"],
      ["Create account", "/sign-up"],
      ["Reset password", "/forgot-password"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_2fr] lg:px-8">
        <div className="max-w-sm">
          <Logo className="h-8 w-auto text-brand" />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Salary-backed cash loans and asset financing, repaid automatically from your pay.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {footerLinks.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold">{group.title}</p>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="transition-colors hover:text-foreground">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} MicroBuilt Prime. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
