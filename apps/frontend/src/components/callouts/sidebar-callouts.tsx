"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { myCallouts } from "@/lib/queries/callouts";
import { readDismissed, readTurn, saveDismissed } from "@/lib/callouts";
import { cn } from "@/lib/utils";
import { CalloutCard } from "./callout-card";

/**
 * The foot of the sidebar: one of the user's (at most three) callouts at a time. A pinned one always opens first;
 * otherwise each visit opens on the next in turn, and the dots page through the rest. Dismissing hides one in this
 * browser only, and the next eligible callout takes its place.
 */
export function SidebarCallouts({ enabled }: { enabled: boolean }) {
  // Read once on the client; nothing renders until the callouts have loaded, so the server never needs them.
  const [dismissed, setDismissed] = useState<string[]>(() => (typeof window === "undefined" ? [] : readDismissed()));
  const [turn] = useState(() => (typeof window === "undefined" ? 0 : readTurn()));
  const [step, setStep] = useState(0);

  const { data } = useQuery({ ...myCallouts(dismissed), enabled });
  const callouts = (data ?? []).filter((callout) => !dismissed.includes(callout.id));
  if (!callouts.length) return null;

  const count = callouts.length;
  const start = callouts[0].pinned ? 0 : turn % count;
  const index = (start + step) % count;
  const callout = callouts[index];

  const dismiss = () => {
    const next = [...dismissed, callout.id];
    saveDismissed(next);
    setDismissed(next);
    setStep(0);
  };

  const footer =
    count > 1 ? (
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Callouts">
          {callouts.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${item.title}`}
              onClick={() => setStep((i - start + count) % count)}
              className={cn(
                "h-1.5 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                i === index ? "w-4 bg-foreground/70" : "w-1.5 bg-foreground/20 hover:bg-foreground/40",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStep((value) => value + 1)}
          aria-label="Next"
          className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Icon icon={icons.chevronRight} size={14} />
        </button>
      </div>
    ) : null;

  return (
    <section aria-label="From MicroBuilt" className="px-2 pb-2">
      <CalloutCard
        key={callout.id}
        callout={callout}
        onDismiss={dismiss}
        footer={footer}
        className="animate-in fade-in-0 duration-300"
      />
    </section>
  );
}
