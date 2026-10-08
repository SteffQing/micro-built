"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supportSession } from "@/lib/queries/support";
import { SupportDialog } from "./support-dialog";

type SupportContext = {
  /** Opens the Help & support modal, on a conversation when given. */
  openSupport: (conversationId?: string | null) => void;
  /** False when chat support is switched off: entry points email the team instead (C14). */
  enabled: boolean;
};

const Context = createContext<SupportContext | null>(null);

export function useSupport(): SupportContext {
  const context = useContext(Context);
  if (!context) throw new Error("useSupport needs a SupportProvider");
  return context;
}

/**
 * The Help & support modal for every signed-in page (mounted in the protected layout). A notification about a staff
 * reply links to `?support=<conversationId>`: any page opens the modal on it, and the param goes from the URL.
 */
export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const session = useQuery(supportSession);

  const openSupport = useCallback((id?: string | null) => {
    if (id !== undefined) setConversationId(id);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ openSupport, enabled: session.data ? session.data.enabled : !session.isError }),
    [openSupport, session.data, session.isError]
  );

  return (
    <Context.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <SupportParam onOpen={openSupport} />
      </Suspense>
      <SupportDialog
        open={open}
        onOpenChange={setOpen}
        conversationId={conversationId}
        onConversationChange={setConversationId}
      />
    </Context.Provider>
  );
}

function SupportParam({ onOpen }: { onOpen: (id: string) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("support");

  useEffect(() => {
    if (!id) return;
    onOpen(id);
    const rest = new URLSearchParams(params);
    rest.delete("support");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [id, onOpen, params, pathname, router]);

  return null;
}
