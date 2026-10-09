"use client";

import { Suspense } from "react";
import { useLinkedParam } from "@/hooks/use-linked-param";
import TopupsTable from "@/ui/topups/topups-table";
import { TopupDetailsModal } from "@/ui/topups/topup-details-modal";

/** `?topup=<id>` (notification links) opens that top-up. */
function LinkedTopup() {
  const { id, close } = useLinkedParam("topup");
  if (!id) return null;
  return (
    <TopupDetailsModal
      id={id}
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    />
  );
}

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <TopupsTable />
      {/* Reading ?topup needs a Suspense boundary. */}
      <Suspense>
        <LinkedTopup />
      </Suspense>
    </div>
  );
}
