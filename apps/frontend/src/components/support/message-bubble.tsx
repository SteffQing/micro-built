"use client";

import { format, isSameDay, isValid } from "date-fns";
import { useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { SupportMarkdown } from "./markdown";
import { ASSISTANT_NAME, PrimeAvatar } from "./prime-avatar";
import { ToolStatus } from "./tool-status";

/** "14:05" today, "3 Oct, 14:05" before. */
function timeLabel(at: Date) {
  return isSameDay(at, new Date()) ? format(at, "HH:mm") : format(at, "d MMM, HH:mm");
}

/** One rendered piece of a message: text, or a tool the assistant is calling. */
export type BubblePart = { kind: "text"; text: string } | { kind: "tool"; name: string; done: boolean };

/** Whose side the thread is read from: the requester's (the chat) or the team's (the staff inbox). */
export type BubbleSide = "requester" | "team";

/** Whether `message` continues a run by the same author, so it drops the name and avatar. */
export function continuesRun(
  message: { role: SupportRole; authorName?: string },
  previous?: { role: SupportRole; authorName?: string }
) {
  return !!previous && message.role !== "SYSTEM" && previous.role === message.role && previous.authorName === message.authorName;
}

/**
 * The reader's own side sits on the right (the requester's messages in the chat; the team's and the assistant's in
 * the inbox), the other side on the left with an avatar (Prime's own for the assistant). System lines are centred. A
 * run of messages by one author shows the avatar once. Names are for screen readers only: the avatar and the "joined
 * the chat" line say who is who.
 */
export function MessageBubble({
  role,
  parts,
  authorName,
  authorImage,
  side = "requester",
  grouped,
  pending,
  streaming,
  onNavigate,
  footer,
  time,
}: {
  role: SupportRole;
  parts: BubblePart[];
  /** Staff: their first name. In the inbox, the requester's name on their messages. */
  authorName?: string;
  authorImage?: string;
  side?: BubbleSide;
  /** Continues a run by the same author (see `continuesRun`). */
  grouped?: boolean;
  /** Sent, not yet confirmed by the API: shown faded. */
  pending?: boolean;
  /** The assistant is still writing this one: show the typing state while it has no text. */
  streaming?: boolean;
  onNavigate?: () => void;
  footer?: React.ReactNode;
  /** When it was sent: shown on hover, or on a tap on touch screens. */
  time?: string | Date;
}) {
  const [showTime, setShowTime] = useState(false);
  const sentAt = time ? new Date(time) : null;
  const when = sentAt && isValid(sentAt) ? sentAt : null;
  const text = parts.filter((part) => part.kind === "text").map((part) => part.text).join("");
  const spacing = grouped ? "mt-1" : "mt-4 first:mt-0";

  if (role === "SYSTEM") {
    return <p className={cn("py-1 text-center text-xs text-muted-foreground", spacing)}>{text}</p>;
  }

  const mine = side === "requester" ? role === "USER" : role !== "USER";
  const branded = side === "requester" ? role === "USER" : role === "STAFF";
  const speaker =
    role === "STAFF"
      ? (authorName ?? "MicroBuilt team")
      : role === "AI"
        ? `${ASSISTANT_NAME} (AI assistant)`
        : side === "team"
          ? (authorName ?? "Requester")
          : "You";
  const tools = parts.filter((part): part is Extract<BubblePart, { kind: "tool" }> => part.kind === "tool");

  const avatar =
    role === "AI" ? (
      <PrimeAvatar />
    ) : (
      <UserAvatar id={authorName ?? role} name={authorName} image={authorImage} size={28} className="shrink-0" />
    );

  return (
    <div
      className={cn("group flex items-start gap-2 transition-opacity", mine && "flex-row-reverse", pending && "opacity-60", spacing)}
      aria-busy={pending || undefined}
      // A tap shows (or hides) the time; a tap on a link or button inside is that link's.
      onClick={(event) => {
        if (!when || (event.target as HTMLElement).closest("a, button")) return;
        setShowTime((shown) => !shown);
      }}
    >
      {!mine && <div className="mt-0.5 w-7 shrink-0">{!grouped && avatar}</div>}
      {mine && side === "team" && role === "AI" && <div className="mt-0.5 w-7 shrink-0">{!grouped && avatar}</div>}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-1.5", mine && "items-end")}>
        <span className="sr-only">{speaker}:</span>
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tools.map((tool, i) => (
              <ToolStatus key={`${tool.name}-${i}`} name={tool.name} done={tool.done} />
            ))}
          </div>
        )}
        {(text || streaming) && (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-sm break-words [overflow-wrap:anywhere]",
              mine ? "rounded-tr-sm" : "rounded-tl-sm",
              branded ? "bg-brand text-brand-foreground [&_a]:text-inherit [&_a]:underline" : "bg-muted"
            )}
          >
            {role === "USER" ? (
              <span className="whitespace-pre-wrap">{text}</span>
            ) : text ? (
              <SupportMarkdown text={text} onNavigate={onNavigate} />
            ) : (
              <span className="flex gap-1 py-1.5" aria-label="Writing a reply">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce"
                    style={{ animationDelay: `${dot * 150}ms` }}
                  />
                ))}
              </span>
            )}
          </div>
        )}
        {footer}
        {when && (
          <time
            dateTime={when.toISOString()}
            // Hover-only devices show it on hover (Tailwind's hover variants apply only where hover exists).
            className={cn("text-[11px] text-muted-foreground tabular-nums", showTime ? "block" : "hidden group-hover:block")}
          >
            {timeLabel(when)}
          </time>
        )}
      </div>
    </div>
  );
}
