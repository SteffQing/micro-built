"use client";

import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, NEXT_PUBLIC_API_URL } from "@/lib/axios";
import { closeOwnSupportConversation, startSupportConversation } from "@/lib/mutations/support";
import { supportBase, supportConversation, supportSession } from "@/lib/queries/support";
import { SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_MAILTO, reportProblem } from "@/lib/support";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { ConversationList } from "./conversation-list";
import { HandoffCard } from "./handoff-card";
import { MessageBubble, continuesRun, type BubblePart } from "./message-bubble";
import { Rating } from "./rating";
import { Suggestions } from "./suggestions";
import { Turnstile, type TurnstileHandle } from "./turnstile";
import { useSupportEvents } from "./use-support-events";

// The support chat (frontend CHAT_SUPPORT.md §1.2): one component for the modal and the /support page. The API holds
// the history, so only the new message is ever sent; a reply streams as the AI SDK's UI message stream and ends with
// a `data-support` part carrying the stored reply's id. Once the conversation is with the team the assistant is
// silent: messages go as plain JSON and replies arrive over the conversation's live events.

type SupportMeta = {
  role: SupportRole;
  serverId: string;
  authorName?: string;
  authorImage?: string;
  rating?: SupportRating | null;
  offerHandoff: boolean;
};
type SupportUIMessage = UIMessage<SupportMeta, { support: SupportReplyData }>;

const WITH_TEAM: SupportStatus[] = ["HANDOFF", "ASSIGNED"];

function toUIMessage(message: SupportMessage): SupportUIMessage {
  return {
    id: message.id,
    role: message.role === "USER" ? "user" : "assistant",
    parts: [{ type: "text", text: message.body }],
    metadata: {
      role: message.role,
      serverId: message.id,
      authorName: message.authorName,
      authorImage: message.authorImage,
      rating: message.rating,
      offerHandoff: message.offerHandoff,
    },
  };
}

/** One copy of each message: a live event can read the thread again before a send's own answer lands. */
function withMessage(thread: SupportThread | undefined, message: SupportMessage) {
  if (!thread || thread.messages.some((m) => m.id === message.id)) return thread;
  return { ...thread, messages: [...thread.messages, message] };
}

const unique = (messages: SupportMessage[]) => messages.filter((m, i) => messages.findIndex((n) => n.id === m.id) === i);

const roleOf = (message: SupportUIMessage): SupportRole =>
  message.metadata?.role ?? (message.role === "user" ? "USER" : "AI");

const textOf = (message: SupportUIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

function bubbleParts(message: SupportUIMessage): BubblePart[] {
  const parts: BubblePart[] = [];
  for (const part of message.parts) {
    if (part.type === "text") parts.push({ kind: "text", text: part.text });
    else if (isToolUIPart(part)) {
      parts.push({ kind: "tool", name: getToolName(part), done: part.state === "output-available" || part.state === "output-error" });
    }
  }
  return parts;
}

/** The stored id and handoff offer of a reply: from the thread, or from the stream's closing data part. */
function replyData(message: SupportUIMessage): SupportReplyData | null {
  if (message.metadata?.serverId) return { messageId: message.metadata.serverId, offerHandoff: message.metadata.offerHandoff };
  const part = message.parts.find((p) => p.type === "data-support");
  return part && part.type === "data-support" ? part.data : null;
}

/** What went wrong with a request, as the chat shows it. */
function describeError(error: unknown): { kind: "limit" | "closed" | "off" | "network" | "refused"; message: string } {
  const status =
    (error as { statusCode?: number })?.statusCode ?? (isAxiosError(error) ? error.response?.status : undefined);
  let message: string | undefined;
  try {
    const body = (error as { responseBody?: string })?.responseBody;
    const parsed = body ? (JSON.parse(body) as { message?: string | string[] }) : isAxiosError(error) ? error.response?.data : undefined;
    message = Array.isArray(parsed?.message) ? parsed.message[0] : parsed?.message;
  } catch {
    message = undefined;
  }
  if (status === 429) return { kind: "limit", message: message ?? "You've sent a lot of messages. Try again later." };
  if (status === 409) return { kind: "closed", message: message ?? "This conversation is closed." };
  if (status === 503) return { kind: "off", message: message ?? "Chat support is switched off." };
  if (status && status >= 400 && status < 500) return { kind: "refused", message: message ?? "That didn't work. Try again." };
  return { kind: "network", message: "Couldn't reach support. Try again." };
}

/** How to reach the team without the chat (C14), and on the /support page. */
export function ContactBlock({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-2 text-sm", className)}>
      <p>
        Email{" "}
        <a href={SUPPORT_MAILTO} className="font-medium text-brand underline underline-offset-2">
          {SUPPORT_EMAIL}
        </a>
        . Office hours: {SUPPORT_HOURS}.
      </p>
      <p>
        Something not working?{" "}
        <button type="button" onClick={() => void reportProblem()} className="font-medium text-brand underline underline-offset-2">
          Report a problem
        </button>
        .
      </p>
    </div>
  );
}

export function SupportChat({
  conversationId,
  onConversationChange,
  variant,
  onNavigate,
  onClose,
}: {
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
  variant: "modal" | "page";
  /** An internal link in a reply was followed (the modal closes). */
  onNavigate?: () => void;
  /** The modal's close button. */
  onClose?: () => void;
}) {
  const session = useQuery(supportSession);
  const queryClient = useQueryClient();
  // The open conversation as last read (the thread's own query, so no extra request): the header follows its status.
  const current = useQuery({ ...supportConversation(conversationId ?? ""), enabled: false });
  const [view, setView] = useState<"chat" | "list">("chat");
  const [pending, setPending] = useState<{ id: string; text: string } | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  /** The first message, shown at once while the conversation is made. */
  const [opening, setOpening] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);
  const start = useMutation(startSupportConversation);
  const end = useMutation(closeOwnSupportConversation);

  const open = (id: string | null) => {
    setView("chat");
    setHandoffOpen(false);
    setStartError(null);
    onConversationChange(id);
  };

  /** A new conversation, then (when given) its first message. */
  const startWith = async (text?: string) => {
    if (!session.data) return;
    setStartError(null);
    setOpening(text ?? null);
    try {
      const token = session.data.turnstileRequired ? await turnstile.current?.getToken() : undefined;
      const conversation = await start.mutateAsync(token);
      // A new conversation is empty: the thread opens on it without reading it first.
      queryClient.setQueryData<SupportThread>(supportConversation(conversation.id).queryKey, { conversation, messages: [] });
      if (text) setPending({ id: conversation.id, text });
      open(conversation.id);
    } catch (error) {
      setStartError(
        error instanceof Error && error.message.startsWith("Turnstile")
          ? "We couldn't confirm you are human. Try again, or email the team."
          : describeError(error).message
      );
    } finally {
      setOpening(null);
    }
  };

  /** A visitor started typing: the Turnstile check runs while they do. */
  const prepareTurnstile = () => {
    if (session.data?.turnstileRequired) turnstile.current?.prepare();
  };

  const data = session.data;
  const currentStatus = conversationId ? current.data?.conversation.status : undefined;
  const header = (
    <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
        {view === "list" ? (
          <Button size="icon" variant="ghost" onClick={() => setView("chat")} aria-label="Back to the chat" className="size-8">
            <Icon icon={icons.arrowLeft} size={16} />
          </Button>
        ) : (
          <Icon icon={icons.support} size={18} className="text-brand" />
        )}
        <span className="truncate text-sm font-semibold">Help &amp; support</span>
      </div>
      {data?.enabled && view === "chat" && data.canHandoff && conversationId && currentStatus !== "CLOSED" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setHandoffOpen(true)}
          disabled={currentStatus !== "AI"}
          className="hidden sm:inline-flex"
        >
          {currentStatus === "HANDOFF" || currentStatus === "ASSIGNED" ? "With the team" : "Talk to the team"}
        </Button>
      )}
      {data?.enabled && view === "chat" && conversationId && currentStatus && currentStatus !== "CLOSED" && (
        <Button size="sm" variant="ghost" disabled={end.isPending} onClick={() => end.mutate(conversationId)}>
          End chat
        </Button>
      )}
      {data?.enabled && (
        <Button
          size="sm"
          variant={view === "list" ? "secondary" : "ghost"}
          onClick={() => setView(view === "list" ? "chat" : "list")}
          aria-pressed={view === "list"}
        >
          <Icon icon={icons.history} size={16} /> <span className="hidden sm:inline">Conversations</span>
        </Button>
      )}
      {onClose && (
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close" className="size-8">
          <Icon icon={icons.x} size={16} />
        </Button>
      )}
    </div>
  );

  let body: React.ReactNode;
  if (session.isLoading) {
    body = (
      <div className="grid flex-1 content-center gap-3 p-6" aria-busy>
        <Skeleton className="mx-auto h-5 w-48" />
        <Skeleton className="mx-auto h-8 w-72" />
      </div>
    );
  } else if (!data || !data.enabled) {
    body = (
      <div className="flex flex-1 flex-col justify-center gap-3 p-6">
        <p className="text-sm text-muted-foreground">
          {session.isError ? "Couldn't reach support right now." : "Chat support isn't available at the moment."} You can
          still reach the team:
        </p>
        <ContactBlock />
      </div>
    );
  } else if (view === "list") {
    body = <ConversationList currentId={conversationId} onOpen={open} onNew={() => void startWith()} starting={start.isPending} />;
  } else if (conversationId) {
    body = (
      <ThreadLoader
        key={conversationId}
        conversationId={conversationId}
        session={data}
        pendingText={pending?.id === conversationId ? pending.text : undefined}
        onPendingSent={() => setPending(null)}
        handoffOpen={handoffOpen}
        setHandoffOpen={setHandoffOpen}
        onNavigate={onNavigate}
        onNewConversation={() => open(null)}
      />
    );
  } else {
    body = (
      <EmptyChat
        session={data}
        starting={start.isPending}
        error={startError}
        opening={opening}
        onType={prepareTurnstile}
        onSend={(text) => void startWith(text)}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col bg-card",
        variant === "modal" ? "h-full" : "min-h-[60dvh] rounded-xl border shadow-xs h-[min(760px,80dvh)]"
      )}
    >
      {header}
      {body}
      {data?.turnstileRequired && <Turnstile ref={turnstile} />}
    </div>
  );
}

function EmptyChat({
  session,
  starting,
  error,
  opening,
  onType,
  onSend,
}: {
  session: SupportSession;
  starting: boolean;
  error: string | null;
  /** The message being sent while the conversation is made. */
  opening: string | null;
  onType: () => void;
  onSend: (text: string) => void;
}) {
  const composer = useRef<HTMLTextAreaElement>(null);
  // Focus without scrolling: on /support the chat sits below the hero.
  useEffect(() => composer.current?.focus({ preventScroll: true }), []);
  return (
    <>
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {opening ? (
          <div className="flex w-full flex-col justify-end px-4 py-4">
            <MessageBubble role="USER" parts={[{ kind: "text", text: opening }]} pending />
          </div>
        ) : (
          <Suggestions session={session} onPick={onSend} disabled={starting} />
        )}
      </div>
      <div className="shrink-0 border-t p-3">
        {error && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Composer ref={composer} onSend={onSend} onType={onType} disabled={starting} maxChars={session.limits.messageChars} />
      </div>
    </>
  );
}

function ThreadLoader(props: Omit<ThreadProps, "thread" | "refetch">) {
  const thread = useQuery(supportConversation(props.conversationId));
  if (thread.isLoading) {
    return (
      <div className="grid flex-1 content-start gap-3 p-4" aria-busy>
        <Skeleton className="ml-auto h-9 w-2/3" />
        <Skeleton className="h-16 w-3/4" />
      </div>
    );
  }
  if (!thread.data) {
    const gone = isAxiosError(thread.error) && thread.error.response?.status === 404;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
        <p className="text-muted-foreground">{gone ? "This conversation isn't available." : "Couldn't load this conversation."}</p>
        <div className="flex gap-2">
          {!gone && (
            <Button variant="outline" onClick={() => void thread.refetch()}>
              Try again
            </Button>
          )}
          <Button onClick={props.onNewConversation}>Start a new conversation</Button>
        </div>
      </div>
    );
  }
  return <Thread {...props} thread={thread.data} refetch={() => void thread.refetch()} />;
}

type ThreadProps = {
  conversationId: string;
  thread: SupportThread;
  refetch: () => void;
  session: SupportSession;
  pendingText?: string;
  onPendingSent: () => void;
  handoffOpen: boolean;
  setHandoffOpen: (open: boolean) => void;
  onNavigate?: () => void;
  onNewConversation: () => void;
};

function Thread({
  conversationId,
  thread,
  refetch,
  session,
  pendingText,
  onPendingSent,
  handoffOpen,
  setHandoffOpen,
  onNavigate,
  onNewConversation,
}: ThreadProps) {
  const queryClient = useQueryClient();
  const status = thread.conversation.status;
  const withTeam = WITH_TEAM.includes(status);
  const [dismissedOffer, setDismissedOffer] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  /** Messages to the team on their way: shown faded until the API has them. */
  const [outbox, setOutbox] = useState<{ id: string; text: string }[]>([]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<SupportUIMessage>({
        api: `${NEXT_PUBLIC_API_URL}${supportBase}/conversations/${conversationId}/messages`,
        credentials: "include",
        // The server holds the history: only the new message goes.
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          return { body: { id: last.id, text: textOf(last) } };
        },
      }),
    [conversationId]
  );

  const initial = useMemo(() => unique(thread.messages).map(toUIMessage), [thread.messages]);
  const chat = useChat<SupportUIMessage>({ id: conversationId, messages: initial, transport });
  const { messages, setMessages, sendMessage, status: chatStatus, stop, error, clearError, regenerate } = chat;
  const streaming = chatStatus === "submitted" || chatStatus === "streaming";

  // The thread was read again (a live event, a handoff, a closed conversation): it is the truth.
  useEffect(() => {
    if (!streaming) setMessages(initial);
    // Only when the thread changes; a finished stream keeps its own messages until then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // The first message, typed before the conversation existed. Sent after mounting settles (a remount, like React's
  // strict mode, cancels the timer instead of a request), then cleared so it goes once.
  useEffect(() => {
    if (!pendingText) return;
    const timer = setTimeout(() => {
      void sendMessage({ text: pendingText });
      onPendingSent();
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingText, sendMessage, onPendingSent]);

  const failure = error ? describeError(error) : null;
  useEffect(() => {
    // A message to a conversation closed (or handed off) elsewhere: read it again to show why.
    if (failure?.kind === "closed") refetch();
  }, [failure?.kind, refetch]);

  const onEvent = useCallback(() => refetch(), [refetch]);
  useSupportEvents(conversationId, withTeam, onEvent);

  const send = async (text: string) => {
    clearError();
    setTeamError(null);
    if (!withTeam) {
      void sendMessage({ text });
      return;
    }
    const id = crypto.randomUUID();
    setOutbox((box) => [...box, { id, text }]);
    try {
      const res = await api.post<ApiRes<SupportMessage>>(`${supportBase}/conversations/${conversationId}/messages`, {
        id,
        text,
      });
      const message = res.data.data;
      if (message) {
        queryClient.setQueryData<SupportThread>(supportConversation(conversationId).queryKey, (old) =>
          withMessage(old, message)
        );
      }
    } catch (err) {
      const problem = describeError(err);
      if (problem.kind === "closed") refetch();
      setTeamError(problem.message);
    } finally {
      setOutbox((box) => box.filter((item) => item.id !== id));
    }
  };

  // Scroll: follow the newest message unless the reader scrolled up; then a pill brings them back.
  // Scrolling to the bottom fires a scroll event, which marks what's there as seen.
  const list = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [seen, setSeen] = useState(() => initial.length);
  const unseen = !atBottom && messages.length > seen;
  const scrollToBottom = (smooth = false) =>
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  useEffect(() => {
    if (atBottom) scrollToBottom();
    // A streaming reply grows without adding messages: follow it too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const composer = useRef<HTMLTextAreaElement>(null);
  // Focus without scrolling: on /support the chat sits below the hero.
  useEffect(() => composer.current?.focus({ preventScroll: true }), []);

  // The handoff card: offered by the last reply (the guard, busy, a thumbs down) or asked for from the header.
  const lastAi = [...messages].reverse().find((m) => m.role === "assistant" && (m.metadata?.role ?? "AI") === "AI");
  const lastAiData = lastAi ? replyData(lastAi) : null;
  const offered = !streaming && !!lastAiData?.offerHandoff && dismissedOffer !== lastAiData.messageId;
  const showHandoff = session.canHandoff && status === "AI" && (handoffOpen || offered);

  return (
    <>
      {withTeam && (
        <p className="shrink-0 border-b bg-muted/60 px-4 py-2 text-center text-xs text-muted-foreground">
          With the team. We&apos;ll reply here and by email.
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        <div
          ref={list}
          role="log"
          aria-live="polite"
          aria-busy={streaming}
          aria-label="Conversation"
          onScroll={(event) => {
            const el = event.currentTarget;
            const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            setAtBottom(bottom);
            if (bottom) setSeen(messages.length);
          }}
          className="h-full overflow-y-auto px-4 py-4"
        >
          {messages.map((message, index) => {
            const role = roleOf(message);
            const isLast = index === messages.length - 1;
            const data = role === "AI" ? replyData(message) : null;
            const finished = !(isLast && streaming);
            const previous = messages[index - 1];
            return (
              <MessageBubble
                key={message.id}
                role={role}
                parts={bubbleParts(message)}
                authorName={message.metadata?.authorName}
                authorImage={message.metadata?.authorImage}
                grouped={
                  !!previous &&
                  continuesRun(
                    { role, authorName: message.metadata?.authorName },
                    { role: roleOf(previous), authorName: previous.metadata?.authorName }
                  )
                }
                // Sent, and the assistant hasn't started answering yet.
                pending={isLast && message.role === "user" && chatStatus === "submitted"}
                streaming={!finished}
                onNavigate={onNavigate}
                footer={
                  data && finished ? (
                    <Rating
                      messageId={data.messageId}
                      initial={message.metadata?.rating}
                      onDown={session.canHandoff && status === "AI" ? () => setHandoffOpen(true) : undefined}
                    />
                  ) : null
                }
              />
            );
          })}
          {outbox.map((item, i) => (
            <MessageBubble
              key={item.id}
              role="USER"
              parts={[{ kind: "text", text: item.text }]}
              grouped={i > 0 || (messages.length > 0 && roleOf(messages[messages.length - 1]) === "USER")}
              pending
            />
          ))}
          {chatStatus === "submitted" && messages[messages.length - 1]?.role === "user" && (
            <MessageBubble role="AI" parts={[]} streaming />
          )}
          {showHandoff && (
            <div className="mt-4">
              <HandoffCard
                conversationId={conversationId}
                visitor={session.audience === "ANONYMOUS"}
                onDone={() => {
                  setHandoffOpen(false);
                  refetch();
                }}
                onDismiss={() => {
                  setHandoffOpen(false);
                  if (lastAiData) setDismissedOffer(lastAiData.messageId);
                }}
              />
            </div>
          )}
        </div>
        {unseen && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground shadow"
          >
            <Icon icon={icons.arrowDown} size={12} /> New messages
          </button>
        )}
      </div>
      <div className="shrink-0 border-t p-3">
        {status === "CLOSED" ? (
          <div className="flex flex-col items-center gap-2 py-1 text-center text-sm">
            <p className="text-muted-foreground">This conversation is closed.</p>
            <Button onClick={onNewConversation}>Start a new conversation</Button>
          </div>
        ) : (
          <>
            {failure && failure.kind !== "closed" && (
              <div role="alert" className="mb-2 flex flex-wrap items-center gap-2 text-sm text-destructive">
                <span>{failure.message}</span>
                {failure.kind === "network" && (
                  <Button size="sm" variant="outline" onClick={() => void regenerate()}>
                    Retry
                  </Button>
                )}
                {failure.kind === "off" && <ContactBlock className="text-foreground" />}
              </div>
            )}
            {teamError && (
              <p role="alert" className="mb-2 text-sm text-destructive">
                {teamError}
              </p>
            )}
            {session.canHandoff && status === "AI" && !showHandoff && (
              <button
                type="button"
                onClick={() => setHandoffOpen(true)}
                className="mb-2 text-xs font-medium text-brand underline-offset-2 hover:underline sm:hidden"
              >
                Talk to the team
              </button>
            )}
            <Composer
              ref={composer}
              onSend={(text) => void send(text)}
              onStop={() => void stop()}
              streaming={streaming}
              disabled={failure?.kind === "off"}
              maxChars={session.limits.messageChars}
              placeholder={withTeam ? "Write to the team…" : "Ask a question…"}
            />
          </>
        )}
      </div>
    </>
  );
}
