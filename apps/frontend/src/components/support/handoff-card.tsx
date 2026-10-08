"use client";

import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { handoffSupportConversation } from "@/lib/mutations/support";

/** "Talk to the team": passes the conversation to staff. A visitor leaves their name and an email or phone number. */
export function HandoffCard({
  conversationId,
  visitor,
  onDone,
  onDismiss,
}: {
  conversationId: string;
  visitor: boolean;
  onDone: (conversation: SupportConversation) => void;
  onDismiss?: () => void;
}) {
  const [contactName, setName] = useState("");
  const [contactEmail, setEmail] = useState("");
  const [contactPhone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const handoff = useMutation(handoffSupportConversation);

  const submit = () => {
    setProblem(null);
    if (visitor && !contactEmail.trim() && !contactPhone.trim()) {
      setProblem("Leave an email address or phone number so the team can reply.");
      return;
    }
    handoff.mutate(
      {
        id: conversationId,
        ...(visitor && {
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        }),
        note: note.trim() || undefined,
      },
      {
        onSuccess: onDone,
        onError: (error) => {
          const message = isAxiosError(error) ? error.response?.data?.message : null;
          setProblem(Array.isArray(message) ? message[0] : (message ?? "Couldn't reach support. Try again."));
        },
      }
    );
  };

  return (
    <section aria-label="Talk to the team" className="rounded-lg border bg-card p-4 text-sm shadow-xs">
      <div className="flex items-start gap-2">
        <Icon icon={icons.support} size={18} className="mt-0.5 shrink-0 text-brand" />
        <p className="flex-1">Pass this conversation to the team? They usually reply within one working day.</p>
      </div>
      <form
        className="mt-3 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {visitor && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="handoff-name">Your name</Label>
              <Input
                id="handoff-name"
                autoComplete="name"
                maxLength={80}
                value={contactName}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="handoff-email">Email</Label>
              <Input id="handoff-email" type="email" autoComplete="email" value={contactEmail} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="handoff-phone">Phone</Label>
              <Input id="handoff-phone" type="tel" autoComplete="tel" value={contactPhone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="handoff-note">Anything to add? (optional)</Label>
          <Textarea id="handoff-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-14" />
        </div>
        {problem && (
          <p role="alert" className="text-destructive">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {onDismiss && (
            <Button type="button" variant="ghost" onClick={onDismiss}>
              Not now
            </Button>
          )}
          <Button type="submit" disabled={handoff.isPending}>
            {handoff.isPending ? "Passing it on…" : "Talk to the team"}
          </Button>
        </div>
      </form>
    </section>
  );
}
