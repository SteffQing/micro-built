"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageTitle from "@/components/page-title";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { organizationsList } from "@/lib/queries/admin/organizations";
import { OrganizationNameDialog } from "./organization-name-dialog";
import ListOfOrganizations from "./table";

/** The employers whose payroll deducts repayments, as the account officers page lists officers. */
export function OrganizationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data, isLoading } = useQuery(organizationsList);

  const filtered = (data?.data ?? []).filter((organization) =>
    organization.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto flex w-full flex-col gap-6 px-4 py-6 md:px-8">
      <PageTitle
        title="Organizations"
        titleAside={
          <OrganizationNameDialog
            trigger={
              <Button type="button" className="h-9">
                <Icon icon={icons.plus} size={16} />
                Add organization
              </Button>
            }
          />
        }
      />

      <Card className="overflow-hidden border shadow-sm">
        <div className="flex items-center gap-4 border-b bg-muted/20 p-4">
          <div className="relative max-w-sm flex-1">
            <Icon
              icon={icons.search}
              size={16}
              className="absolute top-1/2 left-2.5 translate-y-[-50%] text-muted-foreground"
            />
            <Input
              placeholder="Search organizations..."
              aria-label="Search organizations"
              className="bg-background pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ListOfOrganizations list={filtered} loading={isLoading} />
      </Card>
    </div>
  );
}
