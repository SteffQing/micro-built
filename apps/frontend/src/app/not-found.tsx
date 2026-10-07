import type { Metadata } from "next";
import { BackButton, HomeButton, StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <StatusScreen
      tone="notFound"
      code="404"
      title="We can't find that page"
      description="The link may be old, or the page may have moved. Check the address, or head back to your dashboard."
      fullPage
      actions={
        <>
          <HomeButton />
          <BackButton />
        </>
      }
    />
  );
}
