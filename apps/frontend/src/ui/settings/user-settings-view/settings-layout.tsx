import { Card } from "@/components/ui/card";
import { Icon, icons } from "@/components/icon";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ViewType } from ".";

interface SettingsLayoutProps {
  children: ReactNode;
  activeSection: string;
  onSectionChange: (section: string) => void;
  validViews: readonly ViewType[];
}

const settingsItems = [
  {
    id: "profile",
    label: "My Profile",
    icon: icons.user,
  },
  {
    id: "identity",
    label: "User Identity",
    icon: icons.shield,
  },
  {
    id: "payment",
    label: "Payment Method",
    icon: icons.creditCard,
  },
  {
    id: "password",
    label: "Update Password",
    icon: icons.lock,
  },
  {
    id: "security",
    label: "Security",
    icon: icons.shieldAlert,
  },
  {
    id: "authentication",
    label: "2FA & Passkeys",
    icon: icons.lock,
  },
];
export function UserSettingsLayoutCard({
  children,
  activeSection,
  onSectionChange,
  validViews,
}: SettingsLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 lg:flex-row lg:items-start">
      {/* Full viewport height and pinned on desktop, so the nav never scrolls away beside long sections. */}
      <Card className="w-full bg-background p-6 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto">
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold ">Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            You can find all settings here
          </p>
        </div>

        <nav className="space-y-2">
          {settingsItems
            .filter((item) => validViews.includes(item.id as ViewType))
            .map((item) => {
              return (
                <Button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  variant={activeSection === item.id ? "secondary" : "ghost"}
                  className={`w-full flex-center justify-start text-muted-foreground ${
                    activeSection === item.id ? "text-primary" : ""
                  }`}
                >
                  <Icon icon={item.icon} size={16} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Button>
              );
            })}
        </nav>
      </Card>
      <Card className="min-w-0 flex-1 p-4 sm:p-8 bg-background">{children}</Card>
    </div>
  );
}
