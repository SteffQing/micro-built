"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, icons } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Composer } from "@/components/support/composer";
import { MessageBubble, continuesRun } from "@/components/support/message-bubble";
import { TOOL_TOPICS } from "@/components/support/tool-status";
import { useSupportEvents } from "@/components/support/use-support-events";
import {
  claimSupportConversation,
  closeSupportConversation,
  replySupportConversation,
} from "@/lib/mutations/support";
import { staffSupportConversation } from "@/lib/queries/support";
import { cn } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";
import { STAFF_STATUS, requesterLabel } from "./index";

const STAFF_REPLY_CHARS = 4000;

/**
 * One conversation in the inbox: the thread (the assistant's turns read-only), who asked, and claim, reply, close. Read
 * from the team's side: the team's and the assistant's messages on the right, the requester's on the left.
 */
export function SupportThreadView({ id }: { id: string }) {
  const { user } = useUserProvider();
  const thread = useQuery(staffSupportConversation(id));
  const claim = useMutation(claimSupportConversation);
  const reply = useMutation(replySupportConversation);
  const close = useMutation(closeSupportConversation);
  const queryClient = useQueryClient();
  /** Replies on their way: shown faded until the API has them. */
  const [outbox, setOutbox] = useState<{ id: string; text: string }[]>([]);

  const status = thread.data?.conversation.status;
  const refetch = thread.refetch;
  const onEvent = useCallback(() => void refetch(), [refetch]);
  useSupportEvents(id, !!status && status !== "CLOSED", onEvent);

  const list = useRef<HTMLDivElement>(null);
  const count = (thread.data?.messages.length ?? 0) + outbox.length;
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [count]);

  const send = (text: string) => {
    const pendingId = crypto.randomUUID();
    setOutbox((box) => [...box, { id: pendingId, text }]);
    reply.mutate(
      { id, text },
      {
        onSuccess: (res) => {
          const message = res.data;
          if (message) {
            // A live event may have read the thread again first: one copy of each message.
            queryClient.setQueryData<StaffSupportThread>(staffSupportConversation(id).queryKey, (old) =>
              !old || old.messages.some((m) => m.id === message.id)
                ? old
                : { ...old, messages: [...old.messages, { ...message, toolNames: [] }] }
            );
          }
          void refetch();
        },
        onSettled: () => setOutbox((box) => box.filter((item) => item.id !== pendingId)),
      }
    );
  };

  if (thread.isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
        <Skeleton className="h-[60dvh] w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!thread.data) {
    return (
      <Card className="items-center p-8 text-center text-sm text-muted-foreground shadow-none">
        Couldn&apos;t load this conversation.
        <Button variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  const { conversation, requester, messages } = thread.data;
  const who = requesterLabel(requester);
  const mine = conversation.assignee?.id === user?.id;
  const open = conversation.status === "HANDOFF" || conversation.status === "ASSIGNED";
  // The requester's messages carry their name; staff messages already carry theirs.
  const authorOf = (message: StaffSupportMessage) => (message.role === "USER" ? who.primary : message.authorName);

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[1fr_18rem] lg:gap-5">
      <Card className="h-[min(760px,calc(100dvh-10rem))] min-h-[28rem] gap-0 overflow-hidden p-0 shadow-none">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate font-semibold">{conversation.title}</h2>
          <Badge variant="outline" className={cn("border-transparent", STAFF_STATUS[conversation.status].tone)}>
            {STAFF_STATUS[conversation.status].label}
          </Badge>
        </div>
        <div ref={list} role="log" aria-live="polite" aria-label="Conversation" className="min-h-0 flex-1 overflow-y-auto p-4">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              side="team"
              role={message.role}
              parts={[{ kind: "text", text: message.body }]}
              authorName={authorOf(message)}
              authorImage={message.authorImage}
              grouped={
                index > 0 &&
                continuesRun(
                  { role: message.role, authorName: authorOf(message) },
                  { role: messages[index - 1].role, authorName: authorOf(messages[index - 1]) }
                )
              }
              footer={
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(message.createdAt), "d MMM, HH:mm")}
                  {message.role === "AI" &&
                    ` · ${
                      message.toolNames.length
                        ? `Looked at: ${[...new Set(message.toolNames.map((name) => TOOL_TOPICS[name] ?? name))].join(", ")}`
                        : "Answered from its knowledge"
                    }`}
                  {message.rating && ` · rated ${message.rating === "UP" ? "helpful" : "not helpful"}`}
                </p>
              }
            />
          ))}
          {outbox.map((item) => (
            <MessageBubble key={item.id} side="team" role="STAFF" parts={[{ kind: "text", text: item.text }]} grouped pending />
          ))}
        </div>
        <div className="border-t p-3">
          {open ? (
            <Composer
              onSend={send}
              maxChars={STAFF_REPLY_CHARS}
              placeholder={conversation.status === "HANDOFF" ? "Reply (this claims it)…" : "Reply…"}
            />
          ) : (
            <p className="py-1 text-center text-sm text-muted-foreground">
              {conversation.status === "CLOSED" ? "This conversation is closed." : "This conversation is still with Prime, the assistant."}
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-3">
        <Card className="gap-3 p-4 shadow-none">
          <h3 className="text-sm font-semibold">Requester</h3>
          <div>
            <p className="font-medium">{who.primary}</p>
            <p className="text-sm text-muted-foreground">{who.secondary}</p>
          </div>
          {requester.link && (
            <Button asChild size="sm" variant="outline" className="justify-self-start">
              <Link href={requester.link}>
                <Icon icon={icons.arrowUpRight} size={14} /> Open their page
              </Link>
            </Button>
          )}
          {(conversation.contactEmail || conversation.contactPhone) && (
            <dl className="grid gap-1 text-sm">
              {conversation.contactEmail && (
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="break-all">{conversation.contactEmail}</dd>
                </div>
              )}
              {conversation.contactPhone && (
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd>{conversation.contactPhone}</dd>
                </div>
              )}
            </dl>
          )}
        </Card>
        <Card className="gap-3 p-4 shadow-none">
          <h3 className="text-sm font-semibold">Handling</h3>
          <p className="text-sm">
            {conversation.assignee ? (
              <>
                Assigned to <span className="font-medium">{mine ? "you" : conversation.assignee.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Nobody has claimed it yet.</span>
            )}
          </p>
          {conversation.handedOffAt && (
            <p className="text-xs text-muted-foreground">Passed to the team {format(new Date(conversation.handedOffAt), "d MMM yyyy, HH:mm")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {open && !mine && (
              <Button size="sm" disabled={claim.isPending} onClick={() => claim.mutate(id, { onSuccess: () => void refetch() })}>
                {conversation.assignee ? "Take over" : "Claim"}
              </Button>
            )}
            {conversation.status !== "CLOSED" && conversation.status !== "AI" && (
              <Button size="sm" variant="outline" disabled={close.isPending} onClick={() => close.mutate(id, { onSuccess: () => void refetch() })}>
                Close
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
