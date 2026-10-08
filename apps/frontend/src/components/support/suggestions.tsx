"use client";

import { ASSISTANT_NAME, PrimeAvatar } from "./prime-avatar";

/** The empty chat: Prime's greeting and up to four suggestion chips from the session. */
export function Suggestions({
  session,
  onPick,
  disabled,
}: {
  session: SupportSession;
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  const signedIn = session.audience !== "ANONYMOUS";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8 text-center">
      <div className="flex flex-col items-center">
        <PrimeAvatar size={44} className="mb-3" />
        <h2 className="text-lg font-semibold">
          {signedIn && session.firstName ? `Hi ${session.firstName}, I'm ${ASSISTANT_NAME}` : `Hi, I'm ${ASSISTANT_NAME}`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          MicroBuilt&apos;s AI assistant. Ask me anything about MicroBuilt Prime, or ask for the team.
        </p>
      </div>
      <div className="flex max-w-md flex-wrap justify-center gap-2">
        {session.suggestions.slice(0, 4).map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            className="rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
      {!signedIn && <p className="text-xs text-muted-foreground">Sign in to ask about your account.</p>}
    </div>
  );
}
