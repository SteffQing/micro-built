"use client";
import { Suspense } from "react";
import { useLinkedParam } from "@/hooks/use-linked-param";
import { useUserProvider } from "@/store/auth";
import CashLoansTable from "@/ui/loans/cash";
import { CashLoanModal } from "@/ui/modals";

/** `?loan=<id>` (dashboard and notification links) opens that loan. */
function LinkedLoan() {
  const { id, close } = useLinkedParam("loan");
  if (!id) return null;
  return (
    <CashLoanModal
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
            <CashLoansTable />
            {/* Reading ?loan needs a Suspense boundary. */}
            <Suspense>
              <LinkedLoan />
            </Suspense>
          </>
        )}
      </div>
    </>
  );
}
