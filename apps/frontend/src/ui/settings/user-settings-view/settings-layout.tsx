import { Card } from "@/components/ui/card";
import { User, Shield, CreditCard, Lock } from "lucide-react";
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
    icon: User,
  },
  {
    id: "identity",
    label: "User Identity",
    icon: Shield,
  },
  {
    id: "payment",
    label: "Payment Method",
    icon: CreditCard,
  },
  {
    id: "password",
    label: "Update Password",
    icon: Lock,
  },
];
export function UserSettingsLayoutCard({
  children,
  activeSection,
  onSectionChange,
  validViews,
}: SettingsLayoutProps) {
  return (
    <div className="p-4 min-h-screen flex space-x-4 flex-col lg:flex-row space-y-3">
      <Card className=" bg-background w-full lg:w-64 p-6">
        <div className="mb-8">
          <h1 className="text-xl font-semibold ">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You can find all settings here
          </p>
        </div>

        <nav className="space-y-2">
          {settingsItems
            .filter((item) => validViews.includes(item.id as ViewType))
            .map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  variant={activeSection === item.id ? "secondary" : "ghost"}
                  className={`w-full flex-center justify-start text-muted-foreground ${
                    activeSection === item.id ? "text-primary" : ""
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Button>
              );
            })}
        </nav>
      </Card>
      <Card className="flex-1 p-8 bg-background">{children}</Card>
    </div>
  );
}
