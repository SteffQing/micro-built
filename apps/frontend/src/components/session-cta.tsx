import Link from "next/link";
import { cookies } from "next/headers";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Same optimistic check as proxy.ts: a session cookie means the visitor is signed in. If it turns out
// stale, the protected layout sends them to /login, which is where the signed-out buttons lead anyway.
async function hasSession() {
  const jar = await cookies();
  return Boolean(jar.get("__Secure-better-auth.session_token") ?? jar.get("better-auth.session_token"));
}

// On a brand-red band the buttons swap: a white primary, and an outline drawn in white. The primary needs `!` to
// beat .btn-gradient, which sits outside Tailwind's layers; its red is var(--brand), not text-brand, which dark mode
// lightens for dark backgrounds.
const inverse = {
  primary: "bg-none! bg-brand-foreground! text-[var(--brand)]! shadow-none hover:bg-brand-foreground/90!",
  secondary:
    "border-brand-foreground/40 bg-transparent text-brand-foreground shadow-none hover:bg-brand-foreground/10 hover:text-brand-foreground dark:bg-transparent dark:border-brand-foreground/40",
};

/** Landing-page calls to action: "Get started / Sign in" when signed out, "Dashboard" when signed in. */
export async function SessionCta({
  size = "lg",
  signInLabel = "Sign in",
  tone = "default",
  className,
}: {
  size?: "sm" | "lg";
  signInLabel?: string;
  tone?: "default" | "inverse";
  className?: string;
}) {
  const nav = size === "sm";
  const onBrand = tone === "inverse";

  if (await hasSession()) {
    return (
      <Button asChild size={size} className={cn(!nav && "w-full sm:w-auto", onBrand && inverse.primary, className)}>
        <Link href="/dashboard">
          {nav ? "Dashboard" : "Go to dashboard"}
          <Icon icon={icons.arrowRight} size={nav ? 14 : 16} />
        </Link>
      </Button>
    );
  }

  if (nav) {
    return (
      <>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{signInLabel}</Link>
        </Button>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/sign-up">Get started</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Button asChild size="lg" className={cn("w-full sm:w-auto", onBrand && inverse.primary, className)}>
        <Link href="/sign-up">
          Get started
          <Icon icon={icons.arrowRight} size={16} />
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className={cn("w-full sm:w-auto", onBrand && inverse.secondary, className)}
      >
        <Link href="/login">{signInLabel}</Link>
      </Button>
    </>
  );
}
