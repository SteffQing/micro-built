"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Icon, icons, type IconData } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  enablePopups,
  playChime,
  popupPermission,
  setAlertPrefs,
  useAlertPrefs,
  type PopupPermission,
} from "@/lib/notification-alerts";

function setSound(sound: boolean) {
  setAlertPrefs({ sound });
  // Turning it on plays the chime, so the user hears what they chose.
  if (sound) playChime();
}

/** The bell popover's mute button. */
export function SoundToggle({ className }: { className?: string }) {
  const { sound } = useAlertPrefs();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={sound}
      aria-label={sound ? "Sound on for new notifications. Turn off" : "Sound off for new notifications. Turn on"}
      title={sound ? "Sound on" : "Sound off"}
      onClick={() => setSound(!sound)}
      className={cn("size-7 rounded-md text-muted-foreground hover:text-foreground", className)}
    >
      <Icon icon={sound ? icons.sound : icons.soundOff} size={16} />
    </Button>
  );
}

const POPUP_HINT: Record<PopupPermission, string> = {
  granted: "A pop-up from your browser while you're in another tab or app.",
  default: "A pop-up from your browser while you're in another tab or app. Your browser will ask first.",
  denied: "Blocked for this site. Allow notifications in your browser's site settings, then turn this on.",
  unsupported: "This browser can't show pop-ups from a web page.",
};

function Row({
  icon,
  title,
  hint,
  children,
}: {
  icon: IconData;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon icon={icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** How new notifications reach this browser: a chime and a system pop-up. Saved on this device only. */
export function NotificationAlertSettings() {
  const prefs = useAlertPrefs();
  // The browser's answer lives outside React and can change in its own settings, so it is read after mount.
  const [permission, setPermission] = useState<PopupPermission>("default");
  useEffect(() => {
    const read = () => setPermission(popupPermission());
    read();
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, []);
  const popupsOn = prefs.popups && permission === "granted";

  const togglePopups = async (on: boolean) => {
    if (!on) return setAlertPrefs({ popups: false });
    const result = await enablePopups();
    setPermission(result);
    if (result === "denied") toast.error("Pop-ups are blocked for this site. Allow notifications in your browser settings.");
    else if (result === "granted") toast.success("You'll get a pop-up for new notifications while you're away.");
  };

  return (
    <section aria-labelledby="alert-settings" className="rounded-lg border bg-background">
      <div className="px-4 pt-3 pb-1">
        <h2 id="alert-settings" className="text-sm font-semibold">
          Alerts on this device
        </h2>
      </div>
      <div className="divide-y">
        <Row icon={icons.sound} title="Play a sound" hint="A short chime when a new notification arrives.">
          <Switch checked={prefs.sound} onCheckedChange={setSound} aria-label="Play a sound" />
        </Row>
        <Row icon={icons.popup} title="Browser pop-ups" hint={POPUP_HINT[permission]}>
          <Switch
            checked={popupsOn}
            disabled={permission === "unsupported"}
            onCheckedChange={(on) => void togglePopups(on)}
            aria-label="Browser pop-ups"
          />
        </Row>
      </div>
    </section>
  );
}
