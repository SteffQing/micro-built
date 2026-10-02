"use client";

import TopupsTable from "@/ui/topups/topups-table";

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <TopupsTable />
    </div>
  );
}
