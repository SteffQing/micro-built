"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { SupportChat } from "./support-chat";

/** The centred Help & support modal; a full-height drawer on mobile. The same chat fills /support. */
export function SupportDialog({
  open,
  onOpenChange,
  conversationId,
  onConversationChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
}) {
  const isMobile = useIsMobile();
  const close = () => onOpenChange(false);
  const chat = (
    <SupportChat
      variant="modal"
      conversationId={conversationId}
      onConversationChange={onConversationChange}
      onNavigate={close}
      onClose={close}
    />
  );

  if (isMobile) {
    // repositionInputs off: vaul shrinks and moves the drawer while the keyboard is up, and some phone browsers leave
    // it half-height once the keyboard goes (after sending). The full-height drawer lays itself out.
    return (
      <Drawer open={open} onOpenChange={onOpenChange} handleOnly repositionInputs={false}>
        <DrawerContent className="h-[100dvh] data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[100dvh] data-[vaul-drawer-direction=bottom]:rounded-t-none">
          <DrawerTitle className="sr-only">Help &amp; support</DrawerTitle>
          <DrawerDescription className="sr-only">Ask the assistant, or reach the team.</DrawerDescription>
          <div className="min-h-0 flex-1">{chat}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(720px,90dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">Help &amp; support</DialogTitle>
        <DialogDescription className="sr-only">Ask the assistant, or reach the team.</DialogDescription>
        {chat}
      </DialogContent>
    </Dialog>
  );
}
