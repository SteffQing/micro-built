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

/** Landing-page calls to action: "Sign in / Request access" when signed out, "Dashboard" when signed in. */
export async function SessionCta({
  size = "lg",
  signInLabel = "Sign in",
  className,
}: {
  size?: "sm" | "lg";
  signInLabel?: string;
  className?: string;
}) {
  const nav = size === "sm";

  if (await hasSession()) {
    return (
      <Button asChild size={size} className={cn(!nav && "w-full sm:w-auto", className)}>
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
        <Button asChild variant="outline" size="sm">
          <Link href="/login">{signInLabel}</Link>
        </Button>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/sign-up">Request access</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Button asChild size="lg" className={cn("w-full sm:w-auto", className)}>
        <Link href="/sign-up">
          Request access
          <Icon icon={icons.arrowRight} size={16} />
        </Link>
      </Button>
      <Button asChild variant="outline" size="lg" className={cn("w-full sm:w-auto", className)}>
        <Link href="/login">{signInLabel}</Link>
      </Button>
    </>
  );
}
