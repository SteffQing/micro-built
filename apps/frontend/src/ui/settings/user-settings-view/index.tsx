"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ProfileInformation } from "./profile-information";
import { UserSettingsLayoutCard } from "./settings-layout";
import { UpdatePassword } from "./update-password";
import UserIdentity from "./identity";
import { PaymentMethod } from "./payment-method";
import { AuthenticationSettings, SecuritySettings } from "./security";
import { useUserProvider } from "@/store/auth";

const userViews = ["profile", "identity", "payment", "password", "security", "authentication"] as const;
const adminViews = ["profile", "password", "security", "authentication"] as const;

export type ViewType = (typeof userViews)[number];

function isValidView(
  view: string,
  validViews: readonly string[]
): view is ViewType {
  return validViews.includes(view);
}
export function UserSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userRole, needsStrongFactor } = useUserProvider();

  const validViews = userRole !== "CUSTOMER" ? adminViews : userViews;
  const rawView = searchParams.get("view");

  const activeView: ViewType = needsStrongFactor
    ? "authentication"
    : isValidView(rawView ?? "", validViews)
    ? (rawView as ViewType)
    : "profile";

  const renderActiveSection = () => {
    switch (activeView) {
      case "profile":
        return <ProfileInformation />;
      case "identity":
        return <UserIdentity />;
      case "payment":
        return <PaymentMethod />;
      case "password":
        return <UpdatePassword />;
      case "security":
        return <SecuritySettings />;
      case "authentication":
        return <AuthenticationSettings />;
    }
  };

  const handleSectionChange = useCallback(
    (section: string) => {
      router.push(`/settings?view=${section}`);
    },
    [router]
  );

  return (
    <UserSettingsLayoutCard
      activeSection={activeView}
      onSectionChange={handleSectionChange}
      validViews={validViews}
    >
      <>{renderActiveSection()}</>
    </UserSettingsLayoutCard>
  );
}
