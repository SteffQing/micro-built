"use client";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUserProvider } from "@/store/auth";
import CashLoansTable from "@/ui/loans/cash";
import { CashLoanModal } from "@/ui/modals";

/** `?loan=<id>` (dashboard and notification links) opens that loan. */
function LinkedLoan() {
  const id = useSearchParams().get("loan");
  const router = useRouter();
  const pathname = usePathname();
  if (!id) return null;
  return (
    <CashLoanModal
      id={id}
      open
      onOpenChange={(open) => {
        if (!open) router.replace(pathname, { scroll: false });
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
