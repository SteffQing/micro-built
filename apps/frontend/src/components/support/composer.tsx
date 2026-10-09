"use client";

import { forwardRef, useState } from "react";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const COUNTER_FROM = 800;

/** Enter sends, Shift+Enter adds a line; it grows up to 6 lines. While a reply streams it offers Stop instead. */
export const Composer = forwardRef<
  HTMLTextAreaElement,
  {
    onSend: (text: string) => void;
    onStop?: () => void;
    streaming?: boolean;
    disabled?: boolean;
    maxChars: number;
    placeholder?: string;
    /** Every keystroke (a visitor's Turnstile check starts on the first). */
    onType?: () => void;
    /** The box was focused (the chat goes back to the last message). */
    onFocus?: () => void;
  }
>(function Composer(
  { onSend, onStop, streaming, disabled, maxChars, placeholder = "Ask a question…", onType, onFocus },
  ref
) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const over = text.length > maxChars;
  const canSend = !disabled && !streaming && trimmed.length > 0 && !over;

  const send = () => {
    if (!canSend) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Textarea
          ref={ref}
          value={text}
          rows={1}
          aria-label="Message"
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={over || undefined}
          onFocus={onFocus}
          onChange={(event) => {
            setText(event.target.value);
            onType?.();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          className="max-h-[9.5rem] min-h-10 resize-none overflow-y-auto py-2.5 pr-14"
        />
        {text.length >= COUNTER_FROM && (
          <span
            aria-live="polite"
            className={cn("absolute right-2 bottom-2 text-xs tabular-nums text-muted-foreground", over && "text-destructive")}
          >
            {text.length.toLocaleString("en")}/{maxChars.toLocaleString("en")}
          </span>
        )}
      </div>
      {streaming ? (
        <Button type="button" size="icon" variant="outline" onClick={onStop} aria-label="Stop" className="size-10 shrink-0">
          <Icon icon={icons.stop} size={18} />
        </Button>
      ) : (
        <Button type="submit" size="icon" disabled={!canSend} aria-label="Send" className="size-10 shrink-0">
          <Icon icon={icons.send} size={18} />
        </Button>
      )}
    </form>
  );
});
