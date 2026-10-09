"use client";
import { Suspense } from "react";
import { useLinkedParam } from "@/hooks/use-linked-param";
import { useUserProvider } from "@/store/auth";
import CommodityLoansTable from "@/ui/loans/commodity";
import { CommodityLoanModal } from "@/ui/modals";

/** `?request=<id>` (notification links) opens that asset request: a new asset loan or an asset top-up. */
function LinkedAssetRequest() {
  const { id, close } = useLinkedParam("request");
  if (!id) return null;
  return (
    <CommodityLoanModal
      id={id}
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    />
  );
}

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
        {!isUserLoading && userRole === "CUSTOMER" ? (
          <></>
        ) : (
          <>
            <CommodityLoansTable />
            {/* Reading ?request needs a Suspense boundary. */}
            <Suspense>
              <LinkedAssetRequest />
            </Suspense>
          </>
        )}
      </div>
    </>
  );
}
