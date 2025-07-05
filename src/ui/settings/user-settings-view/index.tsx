"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ProfileInformation } from "./profile-information";
import { UserSettingsLayoutCard } from "./settings-layout";
import { UpdatePassword } from "./update-password";
import { UserIdentity } from "./user-identity";
import { PaymentMethod } from "./payment-method";
// import { LoanApplicationModal } from "../dashboard/user-dashboard/loan-aapplication-dialog";

export function UserSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "profile";

  // Validate the view parameter
  const validViews = ["profile", "identity", "payment", "password"];
  const activeView = validViews.includes(view) ? view : "profile";
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
    >
      <>{renderActiveSection()}</>
    </UserSettingsLayoutCard>
  );
}
