"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalloutArt } from "@/components/callouts/callout-art";
import { ContactBlock, SupportChat } from "@/components/support/support-chat";

/**
 * The public Help & support page (frontend CHAT_SUPPORT.md §1.5). Signed out it is a visitor's chat; signed in, the
 * API reads the session and the chat knows the user. `?c=<id>` opens a conversation (the team's reply email links
 * here), and the param follows the open conversation.
 */
export function SupportPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const conversationId = params.get("c");

  const setConversation = (id: string | null) => {
    router.replace(id ? `${pathname}?c=${encodeURIComponent(id)}` : pathname, { scroll: false });
  };

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden border-b">
        <CalloutArt kind="BRAND" seed="support-page" cols={32} rows={5} className="absolute inset-0 h-full w-full opacity-90" />
        <div className="relative mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="inline-block rounded-2xl bg-background/90 px-5 py-4 shadow-sm backdrop-blur-sm">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Help &amp; support</h1>
            <p className="mt-2 text-muted-foreground">
              Ask our assistant anything about MicroBuilt Prime, or reach the team.
            </p>
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-3xl gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <SupportChat variant="page" conversationId={conversationId} onConversationChange={setConversation} />
        <section aria-labelledby="contact-title" className="rounded-xl border bg-card p-5">
          <h2 id="contact-title" className="mb-2 font-semibold">
            Reach the team
          </h2>
          <ContactBlock />
        </section>
      </div>
    </main>
  );
}
