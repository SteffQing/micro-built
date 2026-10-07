"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { CalloutArt } from "@/components/callouts/callout-art";
import { reportProblem } from "@/lib/support";
import { cn } from "@/lib/utils";

/*
 * The app's full-page states: not found (404), not for you (403), something broke (500), and the account that
 * wouldn't load. Each is a card under a mosaic in the brand's colours (the same generator as the sidebar's
 * callouts), with the code set large over it and a way onward.
 */

type Tone = "notFound" | "forbidden" | "error";

const ART: Record<Tone, CalloutKind> = { notFound: "INSIGHT", forbidden: "BRAND", error: "ANNOUNCEMENT" };

export function StatusScreen({
  tone,
  code,
  title,
  description,
  actions,
  reference,
  fullPage = false,
}: {
  tone: Tone;
  /** "404", "403", "500"; shown large over the artwork. */
  code: string;
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  /** An id support can look the problem up by. */
  reference?: string | null;
  /** Outside the app's layout (the 404, the root error): fill the screen. */
  fullPage?: boolean;
}) {
  return (
    <main
      className={cn(
        "flex w-full items-center justify-center bg-background p-4",
        fullPage ? "min-h-dvh" : "min-h-[calc(100dvh-var(--header-height,3rem)-2rem)]",
      )}
    >
      <section
        aria-labelledby="status-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm"
      >
        <div className="relative">
          <CalloutArt kind={ART[tone]} seed={`status-${code}`} rows={7} className="h-40" />
          <span
            aria-hidden
            className="absolute bottom-4 left-5 rounded-xl bg-background/90 px-3 py-1 text-4xl font-semibold tracking-tight tabular-nums shadow-sm backdrop-blur-sm"
          >
            {code}
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:p-6">
          <div className="grid gap-1.5">
            <h1 id="status-title" className="text-xl font-semibold tracking-tight">
              {title}
            </h1>
            <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          {reference && (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Reference <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{reference}</code>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export function HomeButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  return (
    <Button asChild variant={variant}>
      <Link href="/dashboard">
        <Icon icon={icons.dashboard} size={16} />
        Go to dashboard
      </Link>
    </Button>
  );
}

export function BackButton() {
  const router = useRouter();
  return (
    <Button variant="outline" onClick={() => router.back()}>
      <Icon icon={icons.arrowLeft} size={16} />
      Go back
    </Button>
  );
}

export function ReportButton() {
  return (
    <Button variant="ghost" onClick={() => void reportProblem()}>
      <Icon icon={icons.message} size={16} />
      Report a problem
    </Button>
  );
}

/** A page this role can't use (the API would answer 403 too). */
export function AccessDenied({ message }: { message: string }) {
  return (
    <StatusScreen
      tone="forbidden"
      code="403"
      title="This page isn't for your account"
      description={message}
      actions={
        <>
          <HomeButton />
          <BackButton />
        </>
      }
    />
  );
}

/** The signed-in account wouldn't load (the API is down or the session broke). */
export function AccountLoadError() {
  return (
    <StatusScreen
      tone="error"
      code="Oops"
      title="We couldn't load your account"
      description="Check your connection and try again. If it keeps happening, sign in again or let us know."
      actions={
        <>
          <Button onClick={() => window.location.reload()}>
            <Icon icon={icons.refresh} size={16} />
            Try again
          </Button>
          <ReportButton />
        </>
      }
    />
  );
}
