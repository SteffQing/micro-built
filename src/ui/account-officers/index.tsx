"use client";

import PageTitle from "@/components/page-title";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import ListOfAccountOfficers from "./table";
import { useQuery } from "@tanstack/react-query";
import { accountOfficers } from "@/lib/queries/admin/account-officer";

export function AccountOfficersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data, isLoading } = useQuery(accountOfficers);

  const filteredData = data?.data?.filter((officer) =>
    officer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="@container/main flex flex-col gap-6 py-6 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <PageTitle title="Account Officers" />

      <Card className="border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 translate-y-[-50%] h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search officers..."
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ListOfAccountOfficers list={filteredData ?? []} loading={isLoading} />
      </Card>
    </div>
  );
}
